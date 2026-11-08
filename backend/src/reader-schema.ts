import { z } from "zod";
import { identifier } from "./schema.js";
export const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const visitInput = z
  .object({
    sessionId: identifier,
    documentId: digest,
    page: z.number().int().min(0).max(9999),
    chapter: z.string().max(200),
    start: z.number().int().min(0),
    end: z.number().int().min(1),
    textHash: digest,
    startedAt: z.number().int().positive(),
    endedAt: z.number().int().positive(),
    activeMs: z.number().int().min(0).max(86400000),
    words: z.number().int().min(0).max(1200),
    characters: z.number().int().min(1).max(1200),
    reaction: z.enum(["", "Enjoyed", "Difficult", "Rereading"]),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.end <= v.start ||
      v.end - v.start > 1200 ||
      v.endedAt < v.startedAt ||
      v.activeMs > v.endedAt - v.startedAt + 1000 ||
      v.endedAt > Date.now() + 60000
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid page position or reading time.",
      });
  });
export const passageInput = z
  .object({
    page: z.number().int().min(0).max(9999),
    text: z.string().min(1).max(1200),
    consent: z.literal(true),
    sessionId: identifier.optional(),
  })
  .strict();
export const passageResult = z
  .object({
    observations: z
      .array(
        z
          .object({
            dimension: z.enum([
              "vocabulary",
              "sentences",
              "abstraction",
              "density",
              "literary",
              "pacing",
            ]),
            explanation: z.string().min(1).max(400),
            quote: z.string().max(100),
          })
          .strict(),
      )
      .length(6)
      .refine((rows) => new Set(rows.map((r) => r.dimension)).size === 6),
    possibleReasons: z.array(z.string().max(350)).max(3),
    interestSignals: z.array(z.string().max(350)).max(3),
    nextStep: z.string().max(400),
    uncertainty: z.string().min(1).max(400),
  })
  .strict();
