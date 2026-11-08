import { Router } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { database, userRef } from "./store.js";
import { eligibleReaders } from "./discovery.js";
import { catalogSearch, catalogSynopsis, quoteCatalog } from "./catalog.js";
import { generateBookReason } from "./tinker.js";
import { bookFitEvidence, demoFeaturesSchema } from "./book-fit-evidence.js";
import { rankWithAI } from "./recommendation-ranking.js";
import { recommendationEvidence } from "../../shared/recommendation-evidence.js";
import {
  explanationEvidence,
  explanationSupport,
  referencedBooks,
} from "./recommendation-explanation.js";
import { peerMatches } from "../../shared/discovery.js";
import { sameBook, usefulSubjects } from "../../shared/book-recommendations.js";
import {
  discoveryGenres,
  genresFor,
  stylesFor,
  rankCrossGenre,
  splitShelves,
  visibleFeed,
  isAvailable,
  restoreSavedRecommendation,
  type DiscoveryFeed,
  type FeedbackBook,
  type ShelfBook,
  type ReadingExperience,
  type RecommendationDetail,
} from "../../shared/for-you.js";
import { singleFlight } from "../../shared/single-flight.js";
import type { Book, Profile, ReadingSession } from "../../shared/domain.js";
export const recommendations = Router();
const feedFlight = singleFlight<DiscoveryFeed>(),
  detailFlight = singleFlight<RecommendationDetail>();
const fingerprint = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const experienceInput = z.enum(["Beginner", "Experienced"]);
const preference = (uid: string) =>
  userRef(uid).collection("private").doc("discovery-preferences");
const feedRef = (uid: string) =>
  userRef(uid).collection("private").doc("discovery-feed");
async function records(uid: string) {
  const ref = userRef(uid);
  const [p, b, s, f, pref, features] = await Promise.all([
    ref.get(),
    ref.collection("books").get(),
    ref.collection("sessions").get(),
    ref.collection("discoveryFeedback").get(),
    preference(uid).get(),
    ref.collection("private").doc("demo-reading-features").get(),
  ]);
  return {
    profile: (p.data() ?? { topics: [], language: "eng" }) as Profile,
    books: b.docs.map((d) => ({ ...d.data(), id: d.id })) as Book[],
    sessions: s.docs.map((d) => ({
      ...d.data(),
      id: d.id,
    })) as ReadingSession[],
    feedback: Object.fromEntries(f.docs.map((d) => [d.id, d.data()])) as Record<
      string,
      FeedbackBook
    >,
    experience: pref.data()?.experience as ReadingExperience | undefined,
    features: demoFeaturesSchema.safeParse(features.data()).data,
  };
}
recommendations.put("/preferences", async (req, res) => {
  const input = z
    .object({ experience: experienceInput })
    .strict()
    .parse(req.body);
  await preference(res.locals.uid).set(input);
  res.json(input);
});
export async function recommendationFeed(uid: string) {
  const data = await records(uid),
    community = await eligibleReaders(uid);
  const language = data.profile.language ?? "eng";
  const behavior = recommendationEvidence(
    data.books,
    data.sessions,
    data.profile,
    data.feedback,
  );
  const experience =
    data.experience ??
    (community.participation.displayName ? community.participation.tier : null);
  const liked = new Set(
    data.sessions.filter((s) => s.reaction === "Liked it").map((s) => s.bookId),
  );
  const seeds = data.books
    .filter((b) => b.status !== "Dropped" && b.status !== "Want to Read")
    .sort(
      (a, b) =>
        Number(liked.has(b.id)) - Number(liked.has(a.id)) ||
        b.updatedAt - a.updatedAt,
    )
    .slice(0, 3);
  const key = fingerprint({
    version: 7,
    features: data.features,
    evidence: behavior.evidence,
    owned: data.books.map((b) => [b.id, b.title, b.author, b.status]).sort(),
    language,
    topics: data.profile.topics,
    seeds: seeds.map((b) => [b.id, b.title, b.author, b.topics]),
    experience,
    peers: community.readers.map((r) => [r.id, r.tier, r.books]).sort(),
  });
  const base = await feedFlight(uid + key, async () => {
    const cached = (await feedRef(uid).get()).data();
    if (cached?.key === key && cached.expiresAt > Date.now())
      return cached.feed as DiscoveryFeed;
    let tags = [...data.profile.topics, ...seeds.flatMap((b) => b.topics)];
    if (seeds[0]) {
      const seed = seeds[0];
      const matches = await catalogSearch(
        `title:${quoteCatalog(seed.title)}${seed.author ? ` AND author:${quoteCatalog(seed.author)}` : ""}`,
        language,
        4,
      ).catch(() => []);
      const resolved = matches.find((b) => sameBook(b, seed));
      tags = [...tags, ...(resolved?.subjects ?? [])];
    }
    const usual = genresFor(tags),
      signals = stylesFor(tags);
    const outside = discoveryGenres.filter((g) => !usual.includes(g));
    const subjectQuery = outside
      .map((t) => `subject:${quoteCatalog(t)}`)
      .join(" OR ");
    // A broad pool plus a bridge query keeps genres varied while preferring shared style clues.
    const bridgeTags = usefulSubjects(tags).filter(
      (t) => !genresFor([t]).length,
    );
    const bridge = bridgeTags.length
      ? `(${subjectQuery}) AND (${bridgeTags.map((t) => `subject:${quoteCatalog(t)}`).join(" OR ")})`
      : subjectQuery;
    const searches = await Promise.allSettled([
      catalogSearch(bridge, language, 60),
      catalogSearch(subjectQuery, language, 80, true),
      catalogSearch("fiction OR nonfiction", language, 60, true),
    ]);
    if (searches.every((result) => result.status === "rejected"))
      throw Object.assign(
        new Error(
          "The book catalog is temporarily unavailable. Please try again.",
        ),
        { status: 503 },
      );
    const [bridgeBooks, otherBooks, popular] = searches.map((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    const ranked = rankCrossGenre(
      [...bridgeBooks, ...otherBooks, ...popular],
      tags,
      [],
      language,
    );
    const candidates = ranked
      .filter((b) => isAvailable(b, data.books, data.feedback, language))
      .slice(0, 36);
    const split: { personal: ShelfBook[]; explore: ShelfBook[] } =
      splitShelves(candidates);
    let selectionMode: "ai" | "catalog" = "catalog",
      model = "";
    if (behavior.sessionCount > 0 && candidates.length >= 2) {
      try {
        const pool: ShelfBook[] = candidates.map((b) => ({
          ...b,
          shelf: "personal",
          source: "catalog",
        }));
        const result = await rankWithAI(
          uid,
          pool,
          behavior.evidence,
          Object.fromEntries(
            pool.map((b) => [
              b.id,
              bookFitEvidence(
                data.books,
                data.sessions,
                data.profile,
                b.id,
                data.features,
              ),
            ]),
          ),
          !!data.features?.presentationMode,
        );
        const chosen = new Set(
          [...result.ranking.personal, ...result.ranking.explore].map(
            (b) => b.id,
          ),
        );
        for (const kind of ["personal", "explore"] as const) {
          const selected = result.ranking[kind].map((choice) => ({
            ...pool.find((b) => b.id === choice.id)!,
            shelf: kind,
            reason: choice.reason,
            aiSelected: true,
            evidenceIds: choice.evidenceIds,
          }));
          split[kind] = [
            ...selected,
            ...split[kind].filter((b) => !chosen.has(b.id)),
          ];
        }
        selectionMode = "ai";
        model = result.model;
      } catch (error) {
        console.warn(
          "recommendation_ranking_fallback",
          error instanceof Error && error.message.startsWith("TINKER_")
            ? error.message
            : "INVALID_RANKING",
        );
      }
    }
    const peers = experience
      ? peerMatches(community.readers, uid, tags, language, [], [], {
          tier: experience,
          limit: 18,
        })
      : { matches: [], peerCount: 0 };
    const peerBooks: ShelfBook[] = peers.matches.map((b) => ({
      ...b,
      shelf: "peers",
      source: "community",
    }));
    const popularBooks: ShelfBook[] = popular
      .filter((b) => (b.readingLogCount ?? 0) > 0)
      .sort((a, b) => (b.readingLogCount ?? 0) - (a.readingLogCount ?? 0))
      .map((b) => ({
        ...b,
        matchedTopics: genresFor(b.subjects),
        score: b.readingLogCount ?? 0,
        shelf: "peers",
        source: "popular",
        reason: `Saved to ${b.readingLogCount} public Open Library reading logs. A popular catalog pick while your matching reader group grows; this is not a reading-level match.`,
      }));
    const feed: DiscoveryFeed = {
      ...split,
      peers: [...peerBooks, ...popularBooks].slice(0, 60),
      votes: {},
      experience,
      peerCount: peers.peerCount,
      peerSource: peerBooks.length ? "mixed" : "popular",
      language,
      generatedAt: Date.now(),
      usualGenres: usual,
      styleSignals: signals,
      selectionMode,
      model,
      behavior: {
        sessionCount: behavior.sessionCount,
        syntheticSessionCount: behavior.syntheticSessionCount,
      },
      evidence: behavior.evidence,
    };
    await feedRef(uid).set({
      key,
      feed,
      expiresAt:
        Date.now() +
        (selectionMode === "ai" || !behavior.sessionCount
          ? 6 * 3600000
          : 5 * 60000),
    });
    return feed;
  });
  return visibleFeed(base, data.books, data.feedback);
}
recommendations.get("/", async (_req, res) => {
  res.json(await recommendationFeed(res.locals.uid));
});
const workId = z.string().regex(/^OL\d+W$/);
async function offered(uid: string, id: string) {
  const cache = (await feedRef(uid).get()).data();
  const feed = cache?.feed as DiscoveryFeed | undefined;
  const previous = (
    await userRef(uid).collection("discoveryFeedback").doc(id).get()
  ).data();
  const book =
    (feed &&
      [...feed.personal, ...feed.explore, ...feed.peers].find(
        (b) => b.id === id,
      )) ||
    (previous?.book
      ? restoreSavedRecommendation(id, previous.book)
      : undefined);
  if (!book)
    throw Object.assign(
      new Error("Refresh your recommendations and choose a book again."),
      { status: 404 },
    );
  return { book, feed, key: cache?.key };
}
recommendations.put("/:id/feedback", async (req, res) => {
  const uid = res.locals.uid as string,
    id = workId.parse(req.params.id);
  const { value } = z
    .object({ value: z.enum(["yes", "maybe", "no"]) })
    .strict()
    .parse(req.body);
  const { book } = await offered(uid, id),
    ref = userRef(uid);
  const libraryId = await database.runTransaction(async (tx) => {
    const owned = await tx.get(ref.collection("books"));
    const existing = owned.docs.find((d) =>
      sameBook(book, { ...d.data(), id: d.id } as Book),
    );
    let idInLibrary = existing?.id ?? null;
    if (value === "yes" && !existing) {
      const now = Date.now();
      idInLibrary = `ol-${id}`;
      tx.set(ref.collection("books").doc(idInLibrary), {
        id: idInLibrary,
        title: book.title.slice(0, 240),
        author: book.authors.join(", ").slice(0, 160),
        cover: book.cover,
        isbn: "",
        totalPages: null,
        unit: "pages",
        baselinePosition: 0,
        position: 0,
        furthestPosition: 0,
        status: "Want to Read",
        topics: book.matchedTopics.slice(0, 8),
        catalogId: id,
        language: book.language ?? "eng",
        createdAt: now,
        updatedAt: now,
        statusHistory: [{ status: "Want to Read", at: now, reason: "" }],
      });
    }
    tx.set(ref.collection("discoveryFeedback").doc(id), {
      value,
      book,
      updatedAt: Date.now(),
    });
    return idInLibrary;
  });
  res.json({ ok: true, value, libraryId });
});
async function reserveReason(uid: string, presentationMode = false) {
  const day = new Date().toISOString().slice(0, 10),
    local = userRef(uid).collection("private").doc("book-reasons"),
    global = database.collection("private").doc("book-reasons");
  await database.runTransaction(async (tx) => {
    const [u, g] = await Promise.all([tx.get(local), tx.get(global)]);
    const uc = u.data()?.day === day ? u.data()!.count : 0,
      gc = g.data()?.day === day ? g.data()!.count : 0;
    if (uc >= (presentationMode ? 48 : 24) || gc >= 120)
      throw new Error("TINKER_DISCOVERY_LIMIT");
    tx.set(local, { day, count: uc + 1 });
    tx.set(global, { day, count: gc + 1 });
  });
}
export async function recommendationDetails(uid: string, id: string) {
  const { book, feed, key } = await offered(uid, id);
  const data = await records(uid);
  const evidence = explanationEvidence(
    data.books,
    recommendationEvidence(
      data.books,
      data.sessions,
      data.profile,
      data.feedback,
    ).evidence,
  );
  const fit = bookFitEvidence(
    data.books,
    data.sessions,
    data.profile,
    id,
    data.features,
  );
  evidence.push(...fit);
  // Give the writer just two complementary matches, rather than a stats dump.
  const pick = (id: string) => fit.find((e) => e.id === id);
  const paceFit = pick("fit-pace");
  const primary =
    paceFit && JSON.parse(paceFit.text).dialoguePercent != null
      ? paceFit
      : (pick("fit-completion") ?? paceFit);
  const secondary = pick("fit-session") ?? pick("fit-sentences");
  const selectedFit = [pick("fit-connection"), primary, secondary].filter(
    (e): e is NonNullable<typeof e> => !!e,
  );
  const presentationMode = !!data.features?.presentationMode;
  const matchingPace = evidence
    .filter(
      (e) =>
        e.id.startsWith("pace-") &&
        genresFor(book.subjects).includes(JSON.parse(e.text).genre),
    )
    .slice(0, 1);
  const hash = fingerprint({
    version: 10,
    presentationMode,
    key,
    book: id,
    reason: book.reason,
    evidence,
    topics: data.profile.topics,
  });
  const result = await detailFlight(uid + hash, async () => {
    const ref = userRef(uid).collection("recommendationDetails").doc(hash);
    const cached = (await ref.get()).data();
    if (cached && cached.expiresAt > Date.now())
      return cached.result as RecommendationDetail;
    const synopsis = await catalogSynopsis(id).catch(() => "");
    let reason = book.reason,
      reasonSource: "ai" | "catalog" = book.aiSelected ? "ai" : "catalog";
    let support = explanationSupport(
      book.evidenceIds ?? [],
      feed?.evidence ?? [],
    );
    let relatedBooks: string[] = [];
    let expanded = false;
    try {
      await reserveReason(uid, presentationMode);
      const explanation = await generateBookReason(
        {
          book: {
            title: book.title,
            authors: book.authors,
            subjects: book.subjects.slice(0, 20),
          },
          synopsis,
          shelf: book.shelf,
          source: book.source,
          basis: selectedFit.length ? undefined : book.reason,
          usualGenres: feed?.usualGenres ?? [],
          styleSignals: feed?.styleSignals ?? [],
          experience: feed?.experience ?? null,
          preferences: data.profile.topics,
          presentationMode,
          relevantFitEvidenceIds: selectedFit.map((e) => e.id),
          relevantPaceEvidenceIds: selectedFit.length
            ? []
            : matchingPace.map((e) => e.id),
        },
        selectedFit.length
          ? [
              ...selectedFit,
              ...evidence
                .filter((e) => /^(book|library)-/.test(e.id))
                .map((e) => {
                  const v = JSON.parse(e.text);
                  return {
                    id: e.id,
                    text: JSON.stringify({
                      title: v.title,
                      author: v.author,
                      topics: v.topics,
                      status: v.status,
                    }),
                  };
                }),
            ]
          : evidence.filter(
              (e) =>
                !e.id.startsWith("pace-") ||
                matchingPace.some((p) => p.id === e.id),
            ),
      );
      reason = explanation.reason;
      support = explanationSupport(explanation.evidenceIds, evidence);
      relatedBooks = [
        ...new Set(
          referencedBooks(explanation.evidenceIds, evidence).map(
            (b) => b.title,
          ),
        ),
      ];
      reasonSource = "ai";
      expanded = true;
    } catch (error) {
      console.warn(
        "discovery_reason_fallback",
        error instanceof Error && error.message.startsWith("TINKER_")
          ? error.message
          : "INVALID_EXPLANATION",
      );
    }
    const dataPoints = matchingPace.map(
      (e) => JSON.parse(e.text).summary as string,
    );
    const result = {
      synopsis,
      reason,
      reasonSource,
      support,
      relatedBooks,
      dataPoints,
    };
    if (presentationMode) {
      const clean = (text: string) =>
        text
          .replace(/^Demo records: /, "")
          .replace(
            / · (?:\d+ simulated sessions|Includes demo records|Demo book)/g,
            "",
          );
      result.support = result.support.map(clean);
      result.dataPoints = result.dataPoints.map(clean);
    }
    await ref.set({
      result,
      expiresAt: Date.now() + (expanded ? 7 * 86400000 : 5 * 60000),
    });
    return result;
  });
  return result;
}
recommendations.get("/:id/details", async (req, res) => {
  res.json(
    await recommendationDetails(res.locals.uid, workId.parse(req.params.id)),
  );
});
