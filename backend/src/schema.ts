import { z } from "zod";

export const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const topics = z.array(z.string().trim().min(1).max(60)).max(8);
export const bookInput = z
  .object({
    reader: z
      .object({
        documentId: z.string().regex(/^[a-f0-9]{64}$/),
        pageCount: z.number().int().min(1).max(10000),
      })
      .strict()
      .optional(),
    title: z.string().trim().min(1).max(240),
    author: z.string().trim().max(160).default(""),
    cover: z
      .string()
      .max(2000)
      .refine((value) => !value || value.startsWith("https://"))
      .default(""),
    isbn: z.string().max(32).default(""),
    totalPages: z.number().int().min(1).max(100000).nullable().default(null),
    unit: z.enum(["pages", "percent"]),
    baselinePosition: z.number().int().nonnegative().max(100000),
    status: z.enum(["Reading", "Want to Read", "Finished", "Dropped"]),
    dropReason: z.string().trim().max(300).optional(),
    catalogId: z
      .string()
      .regex(/^OL\d+W$/)
      .optional(),
    language: z.enum(["eng", "chi", "fre", "spa", "ger", "jpn"]).optional(),
    topics: topics.default([]),
  })
  .strict()
  .superRefine((book, ctx) => {
    if (book.status === "Dropped" && !book.dropReason)
      ctx.addIssue({
        code: "custom",
        message: "Choose a reason for setting this book aside.",
      });
    const max = book.unit === "percent" ? 100 : (book.totalPages ?? 100000);
    if (book.baselinePosition > max)
      ctx.addIssue({
        code: "custom",
        message: "Starting position exceeds book length",
      });
  });
export const sessionInput = z
  .object({
    bookId: identifier,
    startedAt: z.number().int().positive(),
    endedAt: z.number().int().positive(),
    durationSeconds: z.number().int().min(1).max(86400),
    startPosition: z.number().int().nonnegative().max(100000),
    endPosition: z.number().int().nonnegative().max(100000),
    unit: z.enum(["pages", "percent"]),
    location: z.enum(["", "Home", "Library", "Café", "In Transit", "Other"]),
    reaction: z.enum([
      "",
      "Liked it",
      "Challenging",
      "Relaxing",
      "Want to reread",
    ]),
    stopReason: z.enum([
      "",
      "Time was up",
      "Tired",
      "Distracted",
      "Lost interest",
      "Finished chapter",
    ]),
    topics: topics.default([]),
    note: z.string().trim().max(1500).default(""),
    source: z.enum(["manual", "reader"]),
  })
  .strict()
  .superRefine((session, ctx) => {
    if (
      session.endedAt < session.startedAt ||
      session.durationSeconds * 1000 >
        session.endedAt - session.startedAt + 1000
    )
      ctx.addIssue({
        code: "custom",
        message: "Duration must fit inside the session times",
      });
    if (session.endedAt > Date.now() + 60000)
      ctx.addIssue({
        code: "custom",
        message: "Session cannot end in the future",
      });
  });
export const profileInput = z
  .object({
    language: z.enum(["eng", "chi", "fre", "spa", "ger", "jpn"]).optional(),
    goal: z.string().trim().max(200),
    topics: topics.default([]),
    timezone: z
      .string()
      .max(80)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }),
  })
  .strict();
export const insightInput = z
  .object({
    days: z.union([z.literal(7), z.literal(30), z.literal(0)]),
    timezone: profileInput.shape.timezone,
  })
  .strict();
export const modelResponse = z
  .object({
    cards: z
      .array(
        z
          .object({
            kind: z.enum(["habit", "interest", "suggestion"]),
            title: z.string().min(1).max(100),
            body: z.string().min(1).max(650),
            evidenceIds: z.array(z.string()).min(1).max(5),
          })
          .strict(),
      )
      .length(3),
  })
  .strict()
  .refine(
    (value) => new Set(value.cards.map((card) => card.kind)).size === 3,
    "One card of each kind is required",
  );
