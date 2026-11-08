import { database, userRef } from "./store.js";
import {
  leaderboardSummary,
  type LeaderboardData,
  type LeaderboardReader,
  type LeaderboardParticipation,
} from "../../shared/leaderboard.js";
import type { Book, ReadingSession } from "../../shared/domain.js";

export async function communityLeaderboard(
  uid: string,
  namespace: string,
): Promise<LeaderboardData> {
  const now = Date.now(),
    limit = 200;
  // Include the old opted-in index during migration, plus the new registry.
  // Never expire a reader solely because they did not open the app yesterday.
  const [legacy, registry, permission, blocked] = await Promise.all([
    database.collection(`${namespace}_readers`).limit(limit).get(),
    database.collection(`${namespace}_leaderboard`).limit(limit).get(),
    userRef(uid).collection("private").doc(`${namespace}_participation`).get(),
    userRef(uid).collection(`${namespace}_blocks`).get(),
  ]);
  const excluded = new Set(blocked.docs.map((d) => d.id));
  const ids = [...new Set([...registry.docs, ...legacy.docs].map((d) => d.id))]
    .filter((id) => !excluded.has(id))
    .slice(0, limit);
  const readers: LeaderboardReader[] = [];
  // Bound database fan-out for this small hackathon community.
  for (let start = 0; start < ids.length; start += 10) {
    const group = await Promise.all(
      ids.slice(start, start + 10).map(async (id) => {
        const ref = userRef(id);
        const [p, reverse, profile] = await Promise.all([
          ref.collection("private").doc(`${namespace}_participation`).get(),
          ref.collection(`${namespace}_blocks`).doc(uid).get(),
          ref.get(),
        ]);
        const settings = p.data();
        if (
          !profile.exists ||
          !settings?.active ||
          reverse.exists ||
          !["Beginner", "Experienced"].includes(settings.tier)
        )
          return null;
        const [books, sessions] = await Promise.all([
          ref.collection("books").get(),
          ref.collection("sessions").get(),
        ]);
        const data = profile.data()!;
        return {
          id,
          displayName: settings.displayName,
          tier: settings.tier,
          ...leaderboardSummary(
            books.docs.map((d) => ({ ...d.data(), id: d.id })) as Book[],
            sessions.docs.map((d) => ({
              ...d.data(),
              id: d.id,
            })) as ReadingSession[],
            now,
            data.timezone || "UTC",
            data.demoData?.synthetic === true &&
              data.demoData?.communityPersona === true,
          ),
        } as LeaderboardReader;
      }),
    );
    readers.push(...group.filter((r): r is LeaderboardReader => r !== null));
  }
  const p = permission.data();
  const participation: LeaderboardParticipation = {
    active: !!p?.active,
    displayName: p?.displayName ?? "",
    tier: p?.tier === "Experienced" ? "Experienced" : "Beginner",
  };
  return { readers, participation, generatedAt: now, limit };
}
