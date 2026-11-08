import { test } from "node:test";
import assert from "node:assert/strict";
import { guestTemplatePath, guestProfile, guestRecord } from "../src/guest-template.js";

test("Guest templates allow reading data but exclude identities, devices and quotas", () => {
  for (const path of ["books/a", "sessions/b", "books/a/readerVisits/v", "insights/a", "recommendationDetails/a", "private/demo-reading-features", "bookmarkSessions/s/visits/2"])
    assert(guestTemplatePath(path), path);
  for (const path of ["../users/other", "users/other/books/a", "private/community_participation", "private/community_profile", "private/generation", "private/bookmark-active", "bookmarkDevices/t", "bookmarkSessions/s/events/2", "books/a/readerVisits/v/extra"])
    assert(!guestTemplatePath(path), path);
  assert.deepEqual(guestProfile({ goal: "Read", timezone: "UTC", topics: ["Art"], email: "private", uid: "owner", demoData: { sourceUid: "owner" } }), {
    goal: "Read", timezone: "UTC", topics: ["Art"], demoData: { synthetic: true, guestTemplate: true },
  });
});
test("Copied hardware logs retain visits without inheriting device connection or credentials", () => {
  assert.throws(() => guestRecord("bookmarkSessions/a", { state: { status: "reading" } }));
  const row = guestRecord("bookmarkSessions/a", { pairingHash: "secret", state: { status: "ended", savedAt: 1, connected: true, activeSeconds: 8 } });
  assert.deepEqual(row, { state: { status: "ended", savedAt: 1, connected: false, activeSeconds: 8 } });
  assert.throws(() => guestRecord("private/generation", { count: 50 }));
});
