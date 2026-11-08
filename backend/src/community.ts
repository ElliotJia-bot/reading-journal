import { Router } from "express";
import type {
  DocumentData,
  DocumentSnapshot,
  Transaction,
} from "firebase-admin/firestore";
import { database, userRef } from "./store.js";
import { identifier } from "./schema.js";
import {
  circles,
  sharedCheckin,
  type CommunityPost,
  type CommunityComment,
} from "../../shared/community.js";
import type { Book, ReadingSession } from "../../shared/domain.js";
import {
  circleIdInput,
  communityPostInput,
  commentInput,
  stateInput,
  reportInput,
  blockInput,
} from "./community-schema.js";

// An operator-only namespace lets tests exercise the exact code without publishing
// synthetic conversations into live circles. Clients cannot choose a namespace.
const namespace = process.env.COMMUNITY_NAMESPACE || "community";
if (namespace !== "community" && !/^community_test_[a-z0-9_]+$/.test(namespace))
  throw new Error("Invalid community test namespace");
const collection = database.collection(namespace);
const blockRef = (uid: string, other: string) =>
  userRef(uid).collection(`${namespace}_blocks`).doc(other);
const profileRef = (uid: string) =>
  userRef(uid).collection("private").doc(`${namespace}_profile`);
const fail = (message: string, status: number): never => {
  throw Object.assign(new Error(message), { status });
};
const circleRef = (id: unknown) => collection.doc(circleIdInput.parse(id));
const postRef = (id: unknown, post: unknown) =>
  circleRef(id).collection("posts").doc(identifier.parse(post));
function requirePost(snapshot: DocumentSnapshot): DocumentData {
  if (!snapshot.exists || snapshot.data()?.deletedAt)
    fail("Post not found.", 404);
  return snapshot.data()!;
}
async function blockedAuthors(uid: string, authors: string[]) {
  const unique = [...new Set(authors)].filter((author) => author !== uid);
  if (!unique.length) return new Set<string>();
  const docs = await database.getAll(
    ...unique.flatMap((author) => [
      blockRef(uid, author),
      blockRef(author, uid),
    ]),
  );
  return new Set(
    unique.filter((_, i) => docs[i * 2].exists || docs[i * 2 + 1].exists),
  );
}
async function canInteract(
  tx: Transaction,
  uid: string,
  circle: string,
  author?: string,
) {
  const member = await tx.get(circleRef(circle).collection("members").doc(uid));
  if (!member.exists) fail("Join this circle before sharing or replying.", 403);
  if (author && author !== uid) {
    const pair = await tx.getAll(blockRef(uid, author), blockRef(author, uid));
    if (pair.some((item) => item.exists))
      fail("This conversation is unavailable.", 404);
  }
}
async function quota(tx: Transaction, uid: string, kind: "posts" | "comments") {
  const ref = userRef(uid).collection("private").doc(`${namespace}_quota`);
  const previous = (await tx.get(ref)).data();
  const day = new Date().toISOString().slice(0, 10);
  const value =
    previous?.day === day ? { ...previous } : { day, posts: 0, comments: 0 };
  if ((value[kind] ?? 0) >= (kind === "posts" ? 20 : 80))
    fail(
      "Today's sharing limit is reached. Your reading journal remains available.",
      429,
    );
  value[kind] = (value[kind] ?? 0) + 1;
  return { ref, value };
}
function postDTO(
  id: string,
  data: DocumentData,
  uid: string,
  encouraged: boolean,
): CommunityPost {
  return {
    id,
    circleId: data.circleId,
    authorId: data.authorId,
    authorName: data.authorName,
    kind: data.kind,
    title: data.title,
    body: data.body,
    book: data.book,
    reading: data.reading,
    excerpt: data.excerpt ?? null,
    createdAt: data.createdAt,
    encouragementCount: data.encouragementCount,
    commentCount: data.commentCount,
    encouraged,
    isOwn: data.authorId === uid,
  };
}
async function viewPost(circle: string, id: string, uid: string) {
  const ref = postRef(circle, id);
  const data = requirePost(await ref.get());
  if ((await blockedAuthors(uid, [data.authorId])).size)
    fail("Post not found.", 404);
  const reaction = await ref.collection("encouragements").doc(uid).get();
  return postDTO(id, data, uid, reaction.exists);
}
export const community = Router();
community.get("/", async (_req, res) => {
  const uid = res.locals.uid as string;
  const [docs, members, profile, blocks] = await Promise.all([
    database.getAll(...circles.map((c) => circleRef(c.id))),
    database.getAll(
      ...circles.map((c) => circleRef(c.id).collection("members").doc(uid)),
    ),
    profileRef(uid).get(),
    userRef(uid).collection(`${namespace}_blocks`).get(),
  ]);
  res.json({
    circles: circles.map((c, i) => ({
      ...c,
      memberCount: docs[i].data()?.memberCount ?? 0,
      joined: members[i].exists,
    })),
    displayName: profile.data()?.displayName ?? "",
    testMode: namespace !== "community",
    blockedReaders: blocks.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().displayName || "Reader",
    })),
  });
});
community.put("/circles/:circle/membership", async (req, res) => {
  const ref = circleRef(req.params.circle);
  const uid = res.locals.uid as string;
  const { active } = stateInput.parse(req.body);
  await database.runTransaction(async (tx) => {
    const memberRef = ref.collection("members").doc(uid);
    const [circle, member] = await tx.getAll(ref, memberRef);
    if (member.exists === active) return;
    tx.set(
      ref,
      {
        memberCount: Math.max(
          0,
          (circle.data()?.memberCount ?? 0) + (active ? 1 : -1),
        ),
      },
      { merge: true },
    );
    if (active) tx.set(memberRef, { joinedAt: Date.now() });
    else tx.delete(memberRef);
  });
  res.json({ ok: true });
});
community.get("/circles/:circle/posts", async (req, res) => {
  const uid = res.locals.uid as string;
  const ref = circleRef(req.params.circle);
  const docs = await ref
    .collection("posts")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  const visible = docs.docs.filter((d) => !d.data().deletedAt);
  const blocked = await blockedAuthors(
    uid,
    visible.map((d) => d.data().authorId),
  );
  const selected = visible.filter((d) => !blocked.has(d.data().authorId));
  const reactions = selected.length
    ? await database.getAll(
        ...selected.map((d) => d.ref.collection("encouragements").doc(uid)),
      )
    : [];
  res.json({
    posts: selected.map((doc, i) =>
      postDTO(doc.id, doc.data(), uid, reactions[i].exists),
    ),
    limit: 50,
  });
});
community.put("/posts/:id", async (req, res) => {
  const uid = res.locals.uid as string;
  const id = identifier.parse(req.params.id);
  const input = communityPostInput.parse(req.body);
  const ref = postRef(input.circleId, id);
  await database.runTransaction(async (tx) => {
    await canInteract(tx, uid, input.circleId);
    const existing = await tx.get(ref);
    if (existing.exists) {
      if (existing.data()?.authorId !== uid || existing.data()?.deletedAt)
        fail("This post cannot be changed.", 409);
      return;
    }
    let book: CommunityPost["book"] = null;
    let reading: CommunityPost["reading"] = null;
    if (input.kind === "checkin") {
      const sessionDoc = await tx.get(
        userRef(uid).collection("sessions").doc(input.sessionId),
      );
      if (!sessionDoc.exists) fail("Reading session not found.", 404);
      const session = sessionDoc.data() as ReadingSession;
      const bookDoc = await tx.get(
        userRef(uid).collection("books").doc(session.bookId),
      );
      if (!bookDoc.exists) fail("Book not found.", 404);
      ({ book, reading } = sharedCheckin(
        bookDoc.data() as Book,
        session,
        input.includeDuration,
        input.includeProgress,
      ));
    } else if (input.kind === "reflection") {
      const source = await tx.get(
        userRef(uid).collection("books").doc(input.bookId),
      );
      const data = source.data();
      if (!data?.reader || input.page >= data.reader.pageCount)
        fail("Ebook page not found in your library.", 404);
      book = {
        title: data!.title,
        author: data!.author,
        cover: data!.cover || "",
      };
    } else if (input.kind === "recommendation")
      book = { title: input.bookTitle, author: input.bookAuthor, cover: "" };
    const allowance = await quota(tx, uid, "posts");
    tx.set(allowance.ref, allowance.value);
    tx.set(profileRef(uid), { displayName: input.displayName });
    tx.create(ref, {
      circleId: input.circleId,
      authorId: uid,
      authorName: input.displayName,
      kind: input.kind,
      title: input.kind === "question" ? input.title : "",
      body: input.body,
      book,
      reading,
      excerpt:
        input.kind === "reflection"
          ? { quote: input.quote, page: input.page }
          : null,
      createdAt: Date.now(),
      encouragementCount: 0,
      commentCount: 0,
    });
  });
  res.json(await viewPost(input.circleId, id, uid));
});
community.get("/circles/:circle/posts/:id", async (req, res) => {
  res.json(
    await viewPost(
      circleIdInput.parse(req.params.circle),
      identifier.parse(req.params.id),
      res.locals.uid,
    ),
  );
});
community.put("/circles/:circle/posts/:id/encouragement", async (req, res) => {
  const uid = res.locals.uid as string;
  const circle = circleIdInput.parse(req.params.circle);
  const ref = postRef(circle, req.params.id);
  const { active } = stateInput.parse(req.body);
  await database.runTransaction(async (tx) => {
    const data = requirePost(await tx.get(ref));
    await canInteract(tx, uid, circle, data.authorId);
    const reactionRef = ref.collection("encouragements").doc(uid);
    const reaction = await tx.get(reactionRef);
    if (reaction.exists === active) return;
    tx.update(ref, {
      encouragementCount: Math.max(
        0,
        data.encouragementCount + (active ? 1 : -1),
      ),
    });
    if (active) tx.set(reactionRef, { createdAt: Date.now() });
    else tx.delete(reactionRef);
  });
  res.json(await viewPost(circle, identifier.parse(req.params.id), uid));
});
community.get("/circles/:circle/posts/:id/comments", async (req, res) => {
  const uid = res.locals.uid as string;
  const ref = postRef(req.params.circle, req.params.id);
  await viewPost(
    circleIdInput.parse(req.params.circle),
    identifier.parse(req.params.id),
    uid,
  );
  const comments = await ref
    .collection("comments")
    .orderBy("createdAt", "asc")
    .limit(100)
    .get();
  const blocked = await blockedAuthors(
    uid,
    comments.docs.map((d) => d.data().authorId),
  );
  res.json({
    comments: comments.docs
      .filter((d) => !d.data().deletedAt && !blocked.has(d.data().authorId))
      .map((doc): CommunityComment => {
        const data = doc.data();
        return {
          id: doc.id,
          authorId: data.authorId,
          authorName: data.authorName,
          body: data.body,
          createdAt: data.createdAt,
          isOwn: data.authorId === uid,
        };
      }),
  });
});
community.put(
  "/circles/:circle/posts/:id/comments/:comment",
  async (req, res) => {
    const uid = res.locals.uid as string;
    const circle = circleIdInput.parse(req.params.circle);
    const ref = postRef(circle, req.params.id);
    const input = commentInput.parse(req.body);
    const comment = ref
      .collection("comments")
      .doc(identifier.parse(req.params.comment));
    await database.runTransaction(async (tx) => {
      const data = requirePost(await tx.get(ref));
      await canInteract(tx, uid, circle, data.authorId);
      const existing = await tx.get(comment);
      if (existing.exists) {
        if (existing.data()?.authorId !== uid)
          fail("This reply cannot be changed.", 409);
        return;
      }
      if (data.commentCount >= 100)
        fail("This conversation has reached its reply limit.", 409);
      const allowance = await quota(tx, uid, "comments");
      tx.set(allowance.ref, allowance.value);
      tx.set(profileRef(uid), { displayName: input.displayName });
      tx.create(comment, {
        authorId: uid,
        authorName: input.displayName,
        body: input.body,
        createdAt: Date.now(),
      });
      tx.update(ref, { commentCount: data.commentCount + 1 });
    });
    res.json({ ok: true });
  },
);
community.delete("/circles/:circle/posts/:id", async (req, res) => {
  const ref = postRef(req.params.circle, req.params.id);
  const uid = res.locals.uid as string;
  const removed = await database.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return false;
    if (snapshot.data()?.authorId !== uid)
      fail("Only the author can remove this post.", 403);
    tx.update(ref, {
      deletedAt: Date.now(),
      body: "",
      title: "",
      book: null,
      reading: null,
      excerpt: null,
      commentCount: 0,
      encouragementCount: 0,
    });
    return true;
  });
  if (removed)
    await Promise.all([
      database.recursiveDelete(ref.collection("comments")),
      database.recursiveDelete(ref.collection("encouragements")),
    ]);
  res.json({ ok: true });
});
community.put("/blocks/:author", async (req, res) => {
  const uid = res.locals.uid as string;
  const author = identifier.parse(req.params.author);
  const { active, displayName } = blockInput.parse(req.body);
  if (author === uid) fail("You cannot block yourself.", 400);
  if (active)
    await blockRef(uid, author).set({
      createdAt: Date.now(),
      displayName: displayName || "Reader",
    });
  else await blockRef(uid, author).delete();
  res.json({ ok: true });
});
community.put("/circles/:circle/posts/:id/report", async (req, res) => {
  const uid = res.locals.uid as string;
  const circle = circleIdInput.parse(req.params.circle);
  const id = identifier.parse(req.params.id);
  const { reason } = reportInput.parse(req.body);
  await viewPost(circle, id, uid);
  await database
    .collection(`${namespace}_reports`)
    .doc(`${circle}_${id}_${uid}`)
    .set({
      circleId: circle,
      postId: id,
      reporterId: uid,
      reason,
      createdAt: Date.now(),
      status: "pending",
    });
  res.json({ ok: true });
});
