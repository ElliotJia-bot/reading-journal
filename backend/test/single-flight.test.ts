import { test } from "node:test";
import assert from "node:assert/strict";
import { singleFlight } from "../../shared/single-flight.ts";
test("Rapid coach remounts share a request, while accounts and later updates stay independent", async () => {
  const load = singleFlight<string>();
  let calls = 0;
  let resolve!: (value: string) => void;
  const request = () => {
    calls++;
    return new Promise<string>((done) => {
      resolve = done;
    });
  };
  const first = load("user-a:records-1", request);
  const second = load("user-a:records-1", request);
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(
    await load("user-b:records-1", async () => "other account"),
    "other account",
  );
  resolve("suggestions");
  assert.equal(await first, "suggestions");
  assert.equal(
    await load("user-a:records-1", async () => "revalidated"),
    "revalidated",
  );
});
test("A failed automatic analysis can be retried without a stuck pending request", async () => {
  const load = singleFlight<string>();
  await assert.rejects(
    load("a", async () => {
      throw new Error("offline");
    }),
    /offline/,
  );
  assert.equal(await load("a", async () => "recovered"), "recovered");
});
