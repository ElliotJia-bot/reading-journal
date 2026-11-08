import express from "express";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  aggregate,
  deriveProgress,
  type Book,
  type ReadingSession,
  type Profile,
  type InsightReport,
} from "../../shared/domain.js";
import { database, auth, userRef } from "./store.js";
import {
  identifier,
  bookInput,
  sessionInput,
  profileInput,
  insightInput,
} from "./schema.js";
import { generateInsights } from "./tinker.js";
import { community } from "./community.js";
import { reader } from "./reader.js";
import { discovery, refreshPublicReader } from "./discovery.js";
import { recommendations } from "./recommendations.js";
import { catalog, publishedEbooks } from "./cloud-ebooks.js";
import { matchingSharedEdition } from "../../shared/catalog.js";

import { bookmark, bookmarkBridge } from "./bookmark.js";
import type { BookmarkState } from "../../shared/bookmark.js";

export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const allowed = (
    process.env.ALLOWED_ORIGINS || "http://localhost:8081,http://127.0.0.1:8081"
  ).split(",");
  if (req.headers.origin && allowed.includes(req.headers.origin)) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, PUT, POST, DELETE, OPTIONS",
    );
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "reading-journal" }),
);
app.use("/bookmark-bridge", bookmarkBridge);
app.use("/v1", async (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  try {
    const decoded = await auth.verifyIdToken(token, true);
    res.locals.uid = decoded.uid;
    next();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "authentication_failed",
        code: (error as { code?: string }).code ?? (error as Error).name,
      }),
    );
    res
      .status(401)
      .json({ error: "Your session expired. Please sign in again." });
  }
});

app.use("/v1/community", community);
app.use("/v1/reader", reader);
app.use("/v1/discovery", discovery);
app.use("/v1/recommendations", recommendations);
app.use("/v1/catalog", catalog);

async function loadData(uid: string) {
  const user = userRef(uid);
  const [profile, books, sessions, reports, ebooks] = await Promise.all([
    user.get(),
    user.collection("books").get(),
    user.collection("sessions").get(),
    user.collection("insights").orderBy("generatedAt", "desc").limit(1).get(),
    publishedEbooks(),
  ]);
  return {
    profile: (profile.data() ?? {
      goal: "Build a reading habit",
      timezone: "America/New_York",
      topics: [],
    }) as Profile,
    books: books.docs.map((doc) => {
      const book = { ...doc.data(), id: doc.id } as Book;
      return { ...book, cloudEbook: !!matchingSharedEdition(book, ebooks) };
    }),
    sessions: sessions.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    })) as ReadingSession[],
    insight: reports.empty
      ? null
      : ({
          ...reports.docs[0].data(),
          id: reports.docs[0].id,
        } as InsightReport),
  };
}
app.get("/v1/data", async (_req, res) =>
  res.json(await loadData(res.locals.uid)),
);
app.use("/v1/bookmark", bookmark);
app.put("/v1/profile", async (req, res) => {
  const profile = profileInput.parse(req.body);
  await userRef(res.locals.uid).set(profile, { merge: true });
  await refreshPublicReader(res.locals.uid).catch(() =>
    console.error("public_summary_refresh_failed"),
  );
  res.json(profile);
});
app.put("/v1/books/:id", async (req, res) => {
  const id = identifier.parse(req.params.id);
  const input = bookInput.parse(req.body);
  const user = userRef(res.locals.uid);
  const ref = user.collection("books").doc(id);
  const result = await database.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    const sessions = await tx.get(
      user.collection("sessions").where("bookId", "==", id),
    );
    const items = sessions.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    })) as ReadingSession[];
    if (items.length && items.some((session) => session.unit !== input.unit))
      throw Object.assign(
        new Error(
          "Keep the original progress unit for a book with reading history.",
        ),
        { status: 400 },
      );
    const max = input.unit === "percent" ? 100 : (input.totalPages ?? 100000);
    if (
      items.some(
        (session) => session.endPosition > max || session.startPosition > max,
      )
    )
      throw Object.assign(
        new Error("Book length is shorter than an existing reading position."),
        { status: 400 },
      );
    const book: Book = {
      ...existing.data(),
      id,
      ...input,
      position: input.baselinePosition,
      furthestPosition: input.baselinePosition,
      createdAt: existing.data()?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    if (existing.data()?.reader) book.reader = existing.data()!.reader;
    if (!existing.exists || existing.data()?.status !== input.status) {
      const at = Date.now();
      book.statusHistory = [
        ...(existing.data()?.statusHistory ?? []),
        { status: input.status, at, reason: input.dropReason ?? "" },
      ].slice(-100);
      if (input.status === "Finished") book.completedAt = at;
      if (input.status === "Dropped") book.droppedAt = at;
    }
    if (
      book.reader &&
      (book.unit !== "pages" || book.totalPages !== book.reader.pageCount)
    )
      throw Object.assign(
        new Error("Keep the ebook's original reading-page count and unit."),
        { status: 400 },
      );
    Object.assign(book, deriveProgress(book, items));
    tx.set(ref, book);
    return book;
  });
  await refreshPublicReader(res.locals.uid).catch(() =>
    console.error("public_summary_refresh_failed"),
  );
  res.json(result);
});
app.put("/v1/sessions/:id", async (req, res) => {
  const id = identifier.parse(req.params.id);
  const input = sessionInput.parse(req.body);
  const user = userRef(res.locals.uid);
  const sessionRef = user.collection("sessions").doc(id);
  const bookRef = user.collection("books").doc(input.bookId);
  const result = await database.runTransaction(async (tx) => {
    const [bookSnapshot, existing, sessionSnapshots, bookmarkSnapshot] = await Promise.all([
      tx.get(bookRef),
      tx.get(sessionRef),
      tx.get(user.collection("sessions").where("bookId", "==", input.bookId)),
      input.source === "bookmark" ? tx.get(user.collection("bookmarkSessions").doc(id)) : Promise.resolve(null),
    ]);
    if (!bookSnapshot.exists)
      throw Object.assign(new Error("Book not found."), { status: 404 });
    if (existing.exists && existing.data()?.bookId !== input.bookId)
      throw Object.assign(
        new Error("A session belongs to its original book."),
        { status: 400 },
      );
    const book = bookSnapshot.data() as Book;
    const tracked = bookmarkSnapshot?.data()?.state as BookmarkState | undefined;
    if (input.source === "bookmark") {
      if (!tracked || tracked.status !== "ended" || tracked.bookId !== input.bookId || !tracked.endedAt || tracked.activeSeconds < 1)
        throw Object.assign(new Error("Finish the paired bookmark session before saving."), { status: 409 });
      Object.assign(input, { startedAt: Math.round(tracked.startedAt), endedAt: tracked.endedAt, durationSeconds: Math.floor(tracked.activeSeconds), startPosition: tracked.startPage, endPosition: tracked.currentPage, unit: "pages" });
      tx.update(bookmarkSnapshot!.ref, { "state.savedAt": Date.now() });
    }
    const max = book.unit === "percent" ? 100 : (book.totalPages ?? 100000);
    if (
      input.unit !== book.unit ||
      input.startPosition > max ||
      input.endPosition > max
    )
      throw Object.assign(new Error("Check the reading position and unit."), {
        status: 400,
      });
    const session = {
      ...existing.data(),
      id,
      ...input,
      createdAt: existing.data()?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    const all = sessionSnapshots.docs
      .filter((doc) => doc.id !== id)
      .map((doc) => ({ ...doc.data(), id: doc.id })) as ReadingSession[];
    tx.set(sessionRef, session);
    tx.update(bookRef, {
      ...deriveProgress(book, [...all, session]),
      updatedAt: Date.now(),
      ...(book.status === "Want to Read"
        ? {
            status: "Reading",
            statusHistory: [
              ...(book.statusHistory ?? []),
              {
                status: "Reading",
                at: Date.now(),
                reason: "First saved reading session",
              },
            ].slice(-100),
          }
        : {}),
    });
    return session;
  });
  await refreshPublicReader(res.locals.uid).catch(() =>
    console.error("public_summary_refresh_failed"),
  );
  res.json(result);
});
app.delete("/v1/sessions/:id", async (req, res) => {
  const id = identifier.parse(req.params.id);
  const user = userRef(res.locals.uid);
  await database.runTransaction(async (tx) => {
    const ref = user.collection("sessions").doc(id);
    const session = await tx.get(ref);
    if (!session.exists) return;
    const bookRef = user.collection("books").doc(session.data()!.bookId);
    const [book, sessions] = await Promise.all([
      tx.get(bookRef),
      tx.get(
        user
          .collection("sessions")
          .where("bookId", "==", session.data()!.bookId),
      ),
    ]);
    tx.delete(ref);
    if (book.exists)
      tx.update(bookRef, {
        ...deriveProgress(
          book.data() as Book,
          sessions.docs
            .filter((doc) => doc.id !== id)
            .map((doc) => ({ ...doc.data(), id: doc.id })) as ReadingSession[],
        ),
        updatedAt: Date.now(),
      });
  });
  await refreshPublicReader(res.locals.uid).catch(() =>
    console.error("public_summary_refresh_failed"),
  );
  res.json({ ok: true });
});
app.get("/v1/stats", async (req, res) => {
  const { days, timezone } = insightInput.parse({
    days: Number(req.query.days ?? 7),
    timezone: req.query.timezone ?? "America/New_York",
  });
  const { sessions, books } = await loadData(res.locals.uid);
  res.json(aggregate(sessions, books, days, timezone));
});
app.post("/v1/insights", async (req, res) => {
  const { days, timezone } = insightInput.parse(req.body);
  const uid: string = res.locals.uid;
  const { sessions, books, profile } = await loadData(uid);
  const stats = aggregate(sessions, books, days, timezone);
  if (!stats.sessionCount) {
    res
      .status(400)
      .json({ error: "Log a reading session before generating insights." });
    return;
  }
  const evidence: { id: string; text: string }[] = [
    {
      id: "summary",
      text: JSON.stringify({
        periodDays: days,
        sessionCount: stats.sessionCount,
        totalMinutes: stats.totalMinutes,
        readingDays: stats.readingDays,
        averageMinutes: stats.averageMinutes,
      }),
    },
    { id: "locations", text: JSON.stringify(stats.locations) },
    {
      id: "times",
      text: JSON.stringify({ sessionCountsByStartTime: stats.times }),
    },
    {
      id: "topics",
      text: JSON.stringify({
        secondsByTopic: stats.topics,
        explicitLikedSessionCounts: stats.likedTopics,
      }),
    },
  ];
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        evidence,
        goal: profile.goal,
        promptVersion: "behavioral-coach-3",
      }),
    )
    .digest("hex");
  const reportRef = userRef(uid).collection("insights").doc(fingerprint);
  const existing = await reportRef.get();
  if (existing.exists) {
    res.json({ ...existing.data(), id: fingerprint, cached: true });
    return;
  }
  // A Firestore lease and per-user daily quota also cover concurrent Cloud Run instances.
  const control = userRef(uid).collection("private").doc("generation");
  const globalControl = database.collection("private").doc("generation");
  const lease = randomUUID();
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  await database.runTransaction(async (tx) => {
    const state = (await tx.get(control)).data();
    const globalState = (await tx.get(globalControl)).data();
    if ((state?.expiresAt ?? 0) > now)
      throw Object.assign(
        new Error(
          "An insight is already being generated. Please try again shortly.",
        ),
        { status: 429 },
      );
    const count = state?.day === day ? state.count : 0;
    if (count >= 10)
      throw Object.assign(
        new Error(
          "Your daily insight limit is reached. Reading records and statistics remain available.",
        ),
        { status: 429 },
      );
    const globalCount = globalState?.day === day ? globalState.count : 0;
    if (globalCount >= 50)
      throw Object.assign(
        new Error(
          "Today's demo insight limit is reached. Reading records and statistics remain available.",
        ),
        { status: 429 },
      );
    tx.set(globalControl, { day, count: globalCount + 1 });
    tx.set(control, { lease, expiresAt: now + 90000, day, count: count + 1 });
  });
  try {
    const result = await generateInsights(evidence, profile.goal);
    const report = {
      id: fingerprint,
      generatedAt: Date.now(),
      period: days,
      fingerprint,
      evidence,
      ...result,
    };
    await reportRef.set(report);
    res.json(report);
  } finally {
    await database.runTransaction(async (tx) => {
      const state = await tx.get(control);
      if (state.data()?.lease === lease) tx.update(control, { expiresAt: 0 });
    });
  }
});
app.put("/v1/insights/:id/feedback", async (req, res) => {
  const id = identifier.parse(req.params.id);
  const feedback = z
    .object({
      value: z.enum(["helpful", "not-for-me"]),
      reason: z.string().max(300).default(""),
    })
    .strict()
    .parse(req.body);
  const report = userRef(res.locals.uid).collection("insights").doc(id);
  if (!(await report.get()).exists) {
    res.sendStatus(404);
    return;
  }
  await report.update({ feedback, feedbackAt: Date.now() });
  res.json({ ok: true });
});
app.use(
  (
    error: Error & { status?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({ error: error.issues.map((issue) => issue.message).join(". ") });
      return;
    }
    if (error.status && error.status < 500) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    const modelError =
      error.message.startsWith("TINKER_") || error.name === "TimeoutError";
    console.error(
      JSON.stringify({
        event: "request_failed",
        code: modelError ? error.message.slice(0, 60) : error.name,
      }),
    );
    res.status(modelError ? 503 : 500).json({
      error: modelError
        ? "Reading insights are temporarily unavailable. Your records are saved. Please try again later."
        : "Unable to complete this request. Please try again.",
    });
  },
);
app.listen(Number(process.env.PORT || 8080), "0.0.0.0", () =>
  console.log("Reading Journal backend ready"),
);
