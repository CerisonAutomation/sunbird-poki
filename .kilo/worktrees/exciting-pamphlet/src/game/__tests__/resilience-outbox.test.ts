import { beforeEach, describe, expect, it } from "vitest";
import { OfflineOutbox, type OutboxEntry } from "../resilience/OfflineOutbox";
import { storage } from "../Storage";

beforeEach(() => {
  storage.clear();
});

describe("OfflineOutbox", () => {
  it("enqueues and persists across instances", () => {
    const a = new OfflineOutbox({ storeKey: "test.outbox" });
    expect(a.enqueue("score:distance", "{\"d\":100}")).toBe("added");
    const b = new OfflineOutbox({ storeKey: "test.outbox" });
    expect(b.size).toBe(1);
    expect(b.pending()[0]?.payload).toBe("{\"d\":100}");
  });

  it("REPLACES same-id entries (latest best wins)", () => {
    const q = new OfflineOutbox({ storeKey: "test.outbox" });
    q.enqueue("score:distance", "{\"d\":100}");
    expect(q.enqueue("score:distance", "{\"d\":250}")).toBe("replaced");
    expect(q.size).toBe(1);
    expect(q.pending()[0]?.payload).toBe("{\"d\":250}");
  });

  it("evicts the OLDEST when the cap is hit (never exceeds it)", () => {
    const q = new OfflineOutbox({ storeKey: "test.outbox", cap: 3 });
    q.enqueue("a", "1");
    q.enqueue("b", "2");
    q.enqueue("c", "3");
    expect(q.enqueue("d", "4")).toBe("dropped-full");
    expect(q.size).toBe(3);
    const ids = q.pending().map((e) => e.id);
    expect(ids).toContain("d");
    expect(ids).not.toContain("a");
  });

  it("drains newest-first and removes delivered entries", async () => {
    const q = new OfflineOutbox({ storeKey: "test.outbox", now: () => 1_000 });
    q.enqueue("old", "1");
    q.enqueue("new", "2");
    const seen: string[] = [];
    const sent = await q.drain(async (e: OutboxEntry) => {
      seen.push(e.id);
      return true;
    });
    expect(sent).toBe(2);
    expect(seen).toEqual(["new", "old"]);
    expect(q.size).toBe(0);
  });

  it("stops at the first failed send and KEEPS the entry", async () => {
    const q = new OfflineOutbox({ storeKey: "test.outbox" });
    q.enqueue("a", "1");
    q.enqueue("b", "2");
    let calls = 0;
    const sent = await q.drain(async () => {
      calls += 1;
      return calls === 1; // first (newest) succeeds, second fails
    });
    expect(sent).toBe(1);
    expect(q.size).toBe(1);
    expect(q.pending()[0]?.id).toBe("a");
  });

  it("survives a sender that throws (counts as failure)", async () => {
    const q = new OfflineOutbox({ storeKey: "test.outbox" });
    q.enqueue("a", "1");
    const sent = await q.drain(async () => {
      throw new Error("sender exploded");
    });
    expect(sent).toBe(0);
    expect(q.size).toBe(1);
    expect(q.pending()[0]?.tries).toBe(1);
  });

  it("gives up on poisoned entries after maxTries", async () => {
    const q = new OfflineOutbox({ storeKey: "test.outbox" });
    q.enqueue("dead", "1");
    for (let i = 0; i < 6; i++) await q.drain(async () => false);
    // After 6 recorded tries the entry is skipped, not sent again.
    let called = false;
    await q.drain(
      async () => {
        called = true;
        return true;
      },
      6,
    );
    expect(called).toBe(false);
  });

  it("prunes entries past the TTL", () => {
    let t = 1_000;
    const q = new OfflineOutbox({ storeKey: "test.outbox", now: () => t });
    q.enqueue("a", "1");
    t += 7 * 24 * 60 * 60 * 1000 + 1;
    expect(q.prune()).toBe(1);
    expect(q.size).toBe(0);
  });

  it("ignores a corrupt queue file and boots empty", () => {
    storage.setItem("test.outbox", "{{{not json");
    const q = new OfflineOutbox({ storeKey: "test.outbox" });
    expect(q.size).toBe(0);
    // And it still works afterwards.
    q.enqueue("a", "1");
    expect(q.size).toBe(1);
  });

  it("tolerates non-array and malformed persisted shapes", () => {
    storage.setItem("test.outbox", JSON.stringify({ nope: true }));
    expect(new OfflineOutbox({ storeKey: "test.outbox" }).size).toBe(0);
    storage.setItem("test.outbox", JSON.stringify([42, null, { id: "x", payload: "p" }]));
    const q = new OfflineOutbox({ storeKey: "test.outbox" });
    expect(q.size).toBe(1);
    expect(q.pending()[0]?.id).toBe("x");
  });
});
