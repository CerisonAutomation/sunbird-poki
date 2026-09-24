import { afterEach, describe, expect, it, vi } from "vitest";
import { SquadClient } from "../Squad";
afterEach(() => vi.unstubAllGlobals());
describe("chat delivery feedback", () => {
  it("reports failure so the caller can retain the unsent draft", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const squad = new SquadClient("device", () => "Pilot");
    expect(await squad.sendChat("Hello")).toBe(false);
    expect(squad.state.error).toContain("Message not sent");
  });
  it("acknowledges a successful POST and clears an old delivery error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const squad = new SquadClient("device", () => "Pilot");
    squad.state.error = "Old error";
    expect(await squad.sendChat("Hello")).toBe(true);
    expect(squad.state.error).toBe("");
  });
  it("does not send blank messages", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const squad = new SquadClient("device", () => "Pilot");
    expect(await squad.sendChat("   ")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

it("times out a hung connection and releases the loading state for retry", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  })));
  const squad = new SquadClient("timeout-device", () => "Pilot");
  const pending = squad.refresh();
  await vi.advanceTimersByTimeAsync(10001);
  await pending;
  expect(squad.state.loading).toBe(false);
  expect(squad.state.error).toContain("too long");
  vi.useRealTimers();
});

it("does not submit a second chat message while the first is pending", async () => {
  let finish!: (value: unknown) => void;
  const fetch = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetch);
  const squad = new SquadClient("busy-device", () => "Pilot");
  const first = squad.sendChat("Hello");
  expect(await squad.sendChat("Hello")).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(1);
  finish({ ok: true, json: async () => ({}) });
  expect(await first).toBe(true);
  expect(squad.state.busy).toBe(false);
});

it("failed leave keeps membership and existing chat rather than pretending success", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  const squad = new SquadClient("leave-device", () => "Pilot");
  squad.state.myClubId = 7;
  squad.state.chat = [{ id: 1, name: "Friend", text: "Hi", at: "now" }];
  await squad.leaveClub();
  expect(squad.state.myClubId).toBe(7);
  expect(squad.state.chat).toHaveLength(1);
  expect(squad.state.error).toContain("Could not leave");
});

it("deduplicates repeated chat batches and drops a response from a club just left", async () => {
  const message = { id: 1, name: "Friend", text: "Hi", at: "now" };
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [message, message] }) });
  vi.stubGlobal("fetch", fetch);
  const squad = new SquadClient("chat-device", () => "Pilot");
  squad.state.myClubId = 7;
  await squad.pollChat(false); await squad.pollChat(false);
  expect(squad.state.chat).toEqual([message]);
  let finish!: (value: unknown) => void;
  fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = squad.pollChat(false);
  squad.state.myClubId = null; squad.state.chat = [];
  finish({ ok: true, json: async () => ({ messages: [message] }) });
  await pending;
  expect(squad.state.chat).toEqual([]);
});

it("an acknowledged leave cannot be undone by a failing profile refresh", async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({}) }).mockRejectedValue(new Error("offline"));
  vi.stubGlobal("fetch", fetch);
  const squad = new SquadClient("leave-ack", () => "Pilot");
  squad.state.myClubId = 7; squad.state.chat = [{ id: 1, name: "A", text: "Hi", at: "now" }];
  await squad.leaveClub();
  expect(squad.state.myClubId).toBeNull(); expect(squad.state.chat).toEqual([]);
  expect(squad.state.error).toContain("offline");
});

it("successful polling clears only its own stale-connection error", async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ok: true, json: async () => ({ messages: [] }) });
  vi.stubGlobal("fetch", fetch);
  const squad = new SquadClient("poll-recover", () => "Pilot"); squad.state.myClubId = 7;
  await squad.pollChat(false); expect(squad.state.error).toContain("not updating");
  await squad.pollChat(false); expect(squad.state.error).toBe("");
  squad.state.error = "Message not sent";
  await squad.pollChat(false); expect(squad.state.error).toBe("Message not sent");
});

it("an old club's failed poll cannot poison a different club", async () => {
  let fail!: (error: Error) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise((_resolve, reject) => { fail = reject; })));
  const squad = new SquadClient("late-poll", () => "Pilot"); squad.state.myClubId = 7;
  const pending = squad.pollChat(false); squad.state.myClubId = 8;
  fail(new Error("gone")); await pending;
  expect(squad.state.error).toBe("");
});

it("serializes a user refresh behind a mutation's own reconciliation", async () => {
  let done!: (value: unknown) => void;
  const fetch = vi.fn(() => new Promise(resolve => { done = resolve; })); vi.stubGlobal("fetch", fetch);
  const squad = new SquadClient("refresh-busy", () => "Pilot");
  const pending = squad.sendChat("Hello"); await squad.refresh();
  expect(fetch).toHaveBeenCalledTimes(1);
  done({ ok: true, json: async () => ({}) }); await pending;
});

it("re-enrolls only after explicit consent, retaining game saves and old credentials", async () => {
  const requests: string[] = [];
  const fetch = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.body) requests.push(String(init.body));
    return Promise.resolve({ ok: true, json: async () => String(_url).includes("register") ? { code: "SUN-NEW123" } : String(_url).includes("profile") ? { friends: [], clubId: null } : { clubs: [], mine: null } });
  });
  vi.stubGlobal("fetch", fetch);
  const squad = new SquadClient("old-profile", () => "Pilot");
  const oldKey = localStorage.getItem("sunbird.squad.key.old-profile");
  localStorage.setItem("sunbird.save.v2", "untouched-flight-save");
  squad.state.credentialError = true;
  await squad.startNewProfile(false); expect(fetch).not.toHaveBeenCalled();
  await squad.startNewProfile(true);
  expect(squad.state.registered).toBe(true);
  expect(JSON.parse(requests[0]!).deviceId).not.toBe("old-profile");
  expect(localStorage.getItem("sunbird.squad.key.old-profile")).toBe(oldKey);
  expect(localStorage.getItem("sunbird.save.v2")).toBe("untouched-flight-save");
  const replacement = new SquadClient("old-profile", () => "Pilot");
  await replacement.refresh();
  expect(JSON.parse(requests.at(-1)!).deviceId).toBe(JSON.parse(requests[0]!).deviceId);
  localStorage.removeItem("sunbird.save.v2");
});

it("shows a verified-key recovery explanation instead of an endless generic retry", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "Squad identity could not be verified" }) }));
  const squad = new SquadClient("blocked-key", () => "Pilot"); await squad.refresh();
  expect(squad.state.credentialError).toBe(true);
  expect(squad.state.error).toContain("private key");
  expect(squad.state.registered).toBe(false);
});
