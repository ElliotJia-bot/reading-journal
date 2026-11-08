import { z } from "zod";
import { identifier } from "./schema.js";
export const circleIdInput = z.enum(["fiction", "habit", "philosophy"]);
export const displayNameInput = z.string().trim().min(1).max(40);
const base = { circleId: circleIdInput, displayName: displayNameInput };
export const communityPostInput = z.discriminatedUnion("kind", [
  z
    .object({
      ...base,
      kind: z.literal("reflection"),
      bookId: identifier,
      quote: z.string().trim().min(1).max(600),
      page: z.number().int().min(0).max(9999),
      body: z.string().trim().min(1).max(1200),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("checkin"),
      sessionId: identifier,
      includeDuration: z.boolean(),
      includeProgress: z.boolean(),
      body: z.string().trim().max(600),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("question"),
      title: z.string().trim().min(1).max(140),
      body: z.string().trim().max(1200),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("recommendation"),
      bookTitle: z.string().trim().min(1).max(240),
      bookAuthor: z.string().trim().max(160),
      body: z.string().trim().min(1).max(1200),
    })
    .strict(),
]);
export const commentInput = z
  .object({
    displayName: displayNameInput,
    body: z.string().trim().min(1).max(600),
  })
  .strict();
export const stateInput = z.object({ active: z.boolean() }).strict();
export const blockInput = z
  .object({ active: z.boolean(), displayName: displayNameInput.optional() })
  .strict();
export const reportInput = z
  .object({
    reason: z.enum(["Spam", "Unkind or harmful", "Privacy concern", "Other"]),
  })
  .strict();
