import { z } from "zod";
import { identifier } from "./schema.js";
const seconds = z.number().finite().min(0).max(86400);
const page = z.number().int().min(1).max(100000);
const count = z.number().int().min(0).max(10000);
export const bookmarkPairInput = z.object({ sessionId: identifier, bookId: identifier, startPage: page }).strict();
export const bookmarkEventInput = z.object({
  event: z.enum(["reading_started", "page_completed", "page_started", "reading_paused", "reading_resumed", "navigation_limit", "reading_ended"]),
  page, paused: z.boolean(), elapsed_seconds: seconds, active_reading_seconds: seconds, paused_seconds: seconds,
  start_page: page.optional(), completed_page: page.optional(), new_page: page.optional(), current_page: page.optional(), last_page: page.optional(),
  time_on_page_seconds: seconds.optional(), visit_number: count.optional(), navigation_reason: z.enum(["next", "back", "session_end"]).optional(),
  direction: z.enum(["next", "back"]).optional(), forward_turns: count.optional(), backward_turns: count.optional(),
  total_active_seconds: seconds.optional(), total_paused_seconds: seconds.optional(), firmware_version: z.string().max(30).optional(),
});
export const bookmarkBatchInput = z.object({ events: z.array(z.object({ sequence: z.number().int().min(1).max(20000), observedAt: z.number().int().positive(), event: bookmarkEventInput }).strict()).min(1).max(20) }).strict();
export const bookmarkClaimInput = z.object({ code: z.string().regex(/^[a-f0-9]{32}$/), token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
