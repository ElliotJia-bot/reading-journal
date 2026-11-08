import type { DocumentData } from "firebase-admin/firestore";
import type { CommunityPost } from "../../shared/community.js";

export function postDTO(
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
