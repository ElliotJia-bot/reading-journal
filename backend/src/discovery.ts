import { Router } from "express";
import { communityLeaderboard } from "./leaderboard.js";
import { z } from "zod";
import { database, userRef } from "./store.js";
import { readingSummary, type PublicReader } from "../../shared/discovery.js";
import type { Book, ReadingSession } from "../../shared/domain.js";
export const namespace = process.env.COMMUNITY_NAMESPACE || "community";
if (namespace !== "community" && !/^community_test_[a-z0-9_]+$/.test(namespace))
  throw new Error("Invalid community namespace");
const publicReaders = database.collection(`${namespace}_readers`);
const rankedReaders = database.collection(`${namespace}_leaderboard`);
const participation = (uid: string) =>
  userRef(uid).collection("private").doc(`${namespace}_participation`);
export async function refreshPublicReader(uid: string) {
  await database.runTransaction(async (tx) => {
    const permission = (await tx.get(participation(uid))).data();
    if (!permission?.active) {
      tx.delete(publicReaders.doc(uid));
      tx.delete(rankedReaders.doc(uid));
      return;
    }
    const [books, sessions, profile] = await Promise.all([
      tx.get(userRef(uid).collection("books")),
      tx.get(userRef(uid).collection("sessions")),
      tx.get(userRef(uid)),
    ]);
    const now = Date.now();
    tx.set(rankedReaders.doc(uid), { id: uid, updatedAt: now });
    // Fictional personas can participate in the requested demo leaderboard,
    // without becoming purported real peers in book recommendations.
    if (profile.data()?.demoData?.communityPersona) {
      tx.delete(publicReaders.doc(uid));
      return;
    }
    tx.set(publicReaders.doc(uid), {
      id: uid,
      displayName: permission.displayName,
      tier: permission.tier,
      updatedAt: now,
      language: profile.data()?.language ?? "eng",
      ...readingSummary(
        books.docs.map((d) => ({ ...d.data(), id: d.id })) as Book[],
        sessions.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as ReadingSession[],
        now,
      ),
    });
  });
}
export const discovery = Router();
const recommendationInput = z
  .object({
    title: z.string().trim().min(1).max(240),
    authors: z.array(z.string().max(160)).max(10),
    cover: z
      .string()
      .max(500)
      .refine((v) => !v || /^https:\/\/covers\.openlibrary\.org\//.test(v)),
    subjects: z.array(z.string().max(80)).max(8),
    language: z.enum(["eng", "chi", "fre", "spa", "ger", "jpn"]),
    pageCount: z.number().int().positive().max(100000).nullable(),
  })
  .strict();
discovery.get("/feedback", async (_req, res) => {
  const docs = await userRef(res.locals.uid)
    .collection("discoveryFeedback")
    .get();
  res.json({
    votes: Object.fromEntries(docs.docs.map((d) => [d.id, d.data().value])),
    saved: docs.docs
      .filter((d) => d.data().value === "maybe" && d.data().book)
      .map((d) => ({
        id: d.id,
        ...d.data().book,
        matchedTopics: d.data().book.subjects,
        reason: "You saved this book as Maybe.",
        score: 0,
      })),
  });
});
discovery.put("/feedback/:id", async (req, res) => {
  const id = z
    .string()
    .regex(/^OL\d+W$/)
    .parse(req.params.id);
  const input = z
    .object({
      value: z.enum(["yes", "maybe", "no"]),
      book: recommendationInput.optional(),
    })
    .strict()
    .parse(req.body);
  await userRef(res.locals.uid)
    .collection("discoveryFeedback")
    .doc(id)
    .set({ ...input, updatedAt: Date.now() }, { merge: true });
  res.json({ ok: true });
});
export const participationInput = z
  .object({
    active: z.boolean(),
    displayName: z.string().trim().min(1).max(40),
    tier: z.enum(["Beginner", "Experienced"]),
  })
  .strict();
discovery.put("/participation", async (req, res) => {
  const input = participationInput.parse(req.body),
    uid = res.locals.uid as string;
  await database.runTransaction(async (tx) => {
    tx.set(participation(uid), { ...input, updatedAt: Date.now() });
    if (!input.active) {
      tx.delete(publicReaders.doc(uid));
      tx.delete(rankedReaders.doc(uid));
    }
  });
  if (input.active) await refreshPublicReader(uid);
  res.json({ ok: true });
});
export async function eligibleReaders(uid: string) {
  await refreshPublicReader(uid);
  const [docs, permission, blocks] = await Promise.all([
    publicReaders
      .where("updatedAt", ">", Date.now() - 86400000)
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get(),
    participation(uid).get(),
    userRef(uid).collection(`${namespace}_blocks`).get(),
  ]);
  const blocked = new Set(blocks.docs.map((d) => d.id));
  const candidates = docs.docs.filter((d) => !blocked.has(d.id));
  const reverse = candidates.length
    ? await database.getAll(
        ...candidates.map((d) =>
          userRef(d.id).collection(`${namespace}_blocks`).doc(uid),
        ),
      )
    : [];
  const readers = candidates
    .filter((_, i) => !reverse[i].exists)
    .map((d) => d.data()) as PublicReader[];
  return {
    readers,
    participation: permission.data() ?? {
      active: false,
      displayName: "",
      tier: "Beginner",
    },
    limit: 50,
    updatedAt: Date.now(),
    testMode: namespace !== "community",
  };
}
discovery.get("/readers", async (_req, res) => {
  res.json(await eligibleReaders(res.locals.uid));
});

discovery.get("/leaderboard", async (_req, res) => {
  res.json(await communityLeaderboard(res.locals.uid, namespace));
});
