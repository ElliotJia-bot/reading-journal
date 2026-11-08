import { database, userRef } from "./store.js";
import { postDTO } from "./community-view.js";
import { circles } from "../../shared/community.js";
import {
  profileContent,
  profileVisibility,
  type ReaderProfile,
} from "../../shared/reader-profile.js";
import type { Book, ReadingSession } from "../../shared/domain.js";

const unavailable = (): never => {
  throw Object.assign(new Error("This reader profile is unavailable."), {
    status: 404,
  });
};
export async function readerProfile(
  viewer: string,
  id: string,
  namespace: string,
): Promise<ReaderProfile> {
  const ref = userRef(id),
    own = viewer === id;
  const [profile, permission, name, blocks] = await Promise.all([
    ref.get(),
    ref.collection("private").doc(`${namespace}_participation`).get(),
    ref.collection("private").doc(`${namespace}_profile`).get(),
    own
      ? Promise.resolve([])
      : database.getAll(
          userRef(viewer).collection(`${namespace}_blocks`).doc(id),
          ref.collection(`${namespace}_blocks`).doc(viewer),
        ),
  ]);
  if ((!own && !profile.exists) || blocks.some((d) => d.exists)) unavailable();
  const settings = permission.data() ?? {},
    data = profile.data() ?? {};
  const custom = await database
    .collection(namespace)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  const circleIds = [
    ...new Set([
      ...circles.map((c) => c.id),
      ...custom.docs.filter((d) => d.data().kind === "custom").map((d) => d.id),
    ]),
  ];
  const documents = (
    await Promise.all(
      circleIds.map((c) =>
        database
          .collection(namespace)
          .doc(c)
          .collection("posts")
          .where("authorId", "==", id)
          .get(),
      ),
    )
  )
    .flatMap((s) => s.docs)
    .filter((d) => !d.data().deletedAt)
    .sort((a, b) => b.data().createdAt - a.data().createdAt)
    .slice(0, 50);
  if (!own && !settings.active && !documents.length) unavailable();
  const visible = profileVisibility(own, settings);
  let content: ReturnType<typeof profileContent> | null = null;
  if (visible.library || visible.habits) {
    const [books, sessions] = await Promise.all([
      ref.collection("books").get(),
      ref.collection("sessions").get(),
    ]);
    content = profileContent(
      books.docs.map((d) => ({ ...d.data(), id: d.id })) as Book[],
      sessions.docs.map((d) => ({ ...d.data(), id: d.id })) as ReadingSession[],
      data.timezone || "UTC",
      Date.now(),
      own ||
        (data.demoData?.synthetic === true &&
          data.demoData?.communityPersona === true),
    );
  }
  // Profile posts use the same allowlist and deletion boundary as circle feeds.
  return {
    id,
    displayName:
      settings.displayName ||
      name.data()?.displayName ||
      documents[0]?.data().authorName ||
      "Reader",
    tier: ["Beginner", "Experienced"].includes(settings.tier)
      ? settings.tier
      : null,
    isOwn: own,
    sharing: {
      active: !!settings.active,
      library: !!(settings.active && settings.shareLibrary),
      habits: !!(settings.active && settings.shareHabits),
    },
    library: visible.library ? content!.library : null,
    habits: visible.habits ? content!.habits : null,
    posts: documents.map((d) => postDTO(d.id, d.data(), viewer, false)),
  };
}
