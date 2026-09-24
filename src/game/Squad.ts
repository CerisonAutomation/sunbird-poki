/**
 * Squad — client for the PGlite social server (friends, clubs, chat).
 *
 * Same honesty contract as the leaderboard: when `VITE_SOCIAL_URL` is unset
 * the layer reports `live = false` and the UI shows a clearly-labelled
 * offline state. No fake friends, ever.
 *
 * All calls are fire-and-forget tolerant: a dead server degrades to the
 * offline UI rather than breaking the menu.
 */
import { directoryAvailable, lookupDirectoryPilot, publishPilot, type DirectoryPilot } from "./PilotDirectory";
import { SQUAD_CHAT } from "./edition";

const ENV: Record<string, string | undefined> = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
const API = (ENV.VITE_SOCIAL_URL ?? (ENV.DEV ? "/social" : "")).replace(/\/$/, "");

export type Friend = { name: string; code: string; club_id: number | null };
export type Club = { id: number; name: string; motto: string; members: number };
export type ChatMessage = { id: number; name: string; text: string; at: string };

export type SquadQuest = {
  id: string;
  title: string;
  desc: string;
  target: number;
  rewardCoins: number;
};

export const SQUAD_QUESTS: SquadQuest[] = [
  { id: "migration", title: "🦅 Flock Migration", desc: "Glide 4,000 m across championship circuits", target: 4000, rewardCoins: 150 },
  { id: "drafting", title: "🌪 Slipstream Drafting", desc: "Hold slipstream behind wingmates for 25s", target: 25, rewardCoins: 120 },
  { id: "precision", title: "✦ Perfect Formations", desc: "Chain 8 perfect kinetic carve launches", target: 8, rewardCoins: 100 },
];

/** One row of the wingman list — real data from the social service. */
export type Wingman = Friend & {
  /** Present when the service reports it; never guessed. */
  online?: boolean;
  bestDistance?: number;
  lastSeen?: string;
  /** Saved from a real race (met in a room) — no code was ever exchanged. */
  local?: boolean;
};

export type PilotRequest = { requestId: string; name: string; code: string };

/**
 * The result of looking a pilot up. `status` is the honest outcome, and the
 * card only ever shows fields the service actually returned.
 */
export type PilotLookup = {
  status: "ok" | "unknown" | "self" | "unavailable" | "error";
  /** The code the pilot typed, echoed back so "no such code" is unambiguous. */
  query: string;
  name: string;
  code: string;
  online: boolean;
  club: string;
  bestDistance: number;
  rank: number;
  friend: boolean;
  outgoing: boolean;
  incoming: boolean;
  message: string;
};

export type SquadState = {
  live: boolean;
  loading: boolean;
  busy: boolean;
  friendPage: number;
  clubPage: number;
  error: string;
  registered: boolean;
  credentialError: boolean;
  myCode: string;
  friends: Wingman[];
  clubs: Club[];
  myClubId: number | null;
  chat: ChatMessage[];
  isAutonomous?: boolean;
  /** Pilot Lookup panel. */
  pilotQuery: string;
  lookup: PilotLookup | null;
  lookupBusy: boolean;
  requestsIn: PilotRequest[];
  requestsOut: PilotRequest[];
};

export function emptySquadState(): SquadState {
  return {
    live: true,
    loading: false,
    busy: false,
    friendPage: 0,
    clubPage: 0,
    error: "",
    registered: false,
    credentialError: false,
    myCode: "",
    friends: [],
    clubs: [],
    myClubId: null,
    chat: [],
    isAutonomous: false,
    pilotQuery: "",
    lookup: null,
    lookupBusy: false,
    requestsIn: [],
    requestsOut: [],
  };
}

/** A separate capability from the publicly visible race identity. */
function squadKey(deviceId: string): string {
  const key = `sunbird.squad.key.${deviceId}`;
  try { const saved = localStorage.getItem(key); if (saved && /^[a-f0-9]{64}$/.test(saved)) return saved; } catch { /* memory-only */ }
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, "0")).join("");
  try { localStorage.setItem(key, token); } catch { /* session remains usable */ }
  return token;
}

/** localStorage is shared with older builds: keep only rows that still
 *  describe a real pilot (a name and a SUN- code), never placeholder junk. */
function isStoredWingman(value: unknown): value is Wingman {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.name !== "string" || v.name.trim().length === 0) return false;
  if (v.local === true) return true; // met in a race: real name, no code
  return typeof v.code === "string" && v.code.startsWith("SUN-");
}

function isStoredChat(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.text === "string" && typeof v.name === "string";
}

class SquadError extends Error { constructor(message: string, readonly status: number) { super(message); } }
const CHAT_STALE = "Chat is not updating. Your messages are kept; try Refresh.";

async function call<T>(path: string, token: string, init?: RequestInit, lifetime?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  lifetime?.addEventListener("abort", abort, { once: true });
  if (lifetime?.aborted) controller.abort();
  const timer = setTimeout(abort, 10000);
  try {
    const res = await fetch(`${API}${path}`, {
      ...init, signal: controller.signal, cache: "no-store",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
    const body = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new SquadError(body?.error || `Squad request failed (${res.status})`, res.status);
    return body;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Squad took too long to respond. Check your connection and retry.");
    throw error;
  } finally { clearTimeout(timer); lifetime?.removeEventListener("abort", abort); }
}

export class SquadClient {
  readonly state = emptySquadState();
  private lastChatId = 0;
  private chatClub: number | null = null;
  private polling = false;
  private token: string;
  private readonly identityKey: string;
  private readonly lifetime = new AbortController();
  private membershipEpoch = 0;
  private onChange: () => void = () => undefined;
  isAutonomous = false;

  constructor(
    private deviceId: string,
    private readonly nameOf: () => string,
  ) {
    this.identityKey = `sunbird.squad.identity.${deviceId}`;
    try {
      const saved = localStorage.getItem(this.identityKey);
      if (saved && /^[a-f0-9-]{32,64}$/.test(saved)) this.deviceId = saved;
    } catch { /* retain existing identity */ }
    this.token = squadKey(this.deviceId);
  }

  dispose(): void { this.onChange = () => undefined; this.lifetime.abort(); }

  enableAutonomous(): void {
    this.isAutonomous = true;
    this.state.isAutonomous = true;
    this.state.live = true;
    this.state.registered = true;
    this.state.credentialError = false;
    this.state.error = "";

    // Generate or load persistent friend code
    let localCode = "";
    try {
      localCode = localStorage.getItem("sunbird.squad.local_code") || "";
    } catch { /* memory only */ }
    if (!localCode || !localCode.startsWith("SUN-")) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let suffix = "";
      for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
      localCode = `SUN-${suffix}`;
      try { localStorage.setItem("sunbird.squad.local_code", localCode); } catch { /* ignore */ }
    }
    this.state.myCode = localCode;

    // Clubs are only ever ones this pilot founded or joined. Seeding a few
    // fictional clubs with fictional member counts made an empty screen look
    // busy — which is the same lie in a different row.
    let clubs: Club[] = [];
    try {
      const savedClubs = localStorage.getItem("sunbird.squad.local_clubs");
      if (savedClubs) {
        const parsed = JSON.parse(savedClubs) as unknown;
        if (Array.isArray(parsed)) clubs = parsed.filter((c): c is Club => Boolean(c) && typeof (c as Club).name === "string");
      }
    } catch { /* start empty */ }
    this.state.clubs = clubs;

    // Wingmen are only ever real pilots this device verified. Nothing is
    // seeded: an invented list of "friends" is worse than an empty one, and
    // offline there is no way to verify a stranger's code, so the panel says
    // exactly that instead of inventing a name to fill the row.
    let friends: Wingman[] = [];
    try {
      const savedFriends = localStorage.getItem("sunbird.squad.local_friends");
      if (savedFriends) {
        const parsed = JSON.parse(savedFriends) as unknown;
        if (Array.isArray(parsed)) friends = parsed.filter(isStoredWingman);
      }
    } catch { /* start empty */ }
    this.state.friends = friends;

    // No default membership: a pilot is in a club only if they joined one.
    let clubId: number | null = null;
    try {
      const savedClubId = localStorage.getItem("sunbird.squad.local_club_id");
      if (savedClubId !== null && savedClubId !== "") clubId = Number(savedClubId);
    } catch { /* not a member */ }
    this.setMembership(clubId);

    // Club chat only holds messages this device actually received: the seeded
    // conversation starters were invented people discussing races that never
    // happened.
    if (clubId) {
      let chat: ChatMessage[] = [];
      try {
        const savedChat = localStorage.getItem(`sunbird.squad.local_chat.${clubId}`);
        if (savedChat) {
          const parsed = JSON.parse(savedChat) as unknown;
          if (Array.isArray(parsed)) chat = parsed.filter(isStoredChat);
        }
      } catch { /* start empty */ }
      this.state.chat = chat;
    }

    this.onChange();
  }

  /** Explicit re-enrollment, never an unauthenticated claim of an old profile. */
  async startNewProfile(confirmed: boolean): Promise<void> {
    if (!confirmed || !this.state.credentialError || this.state.busy || this.state.loading) return;
    const id = [...crypto.getRandomValues(new Uint8Array(20))].map(n => n.toString(16).padStart(2, "0")).join("");
    const token = squadKey(id);
    try {
      if (localStorage.getItem(`sunbird.squad.key.${id}`) !== token) throw new Error("storage");
      localStorage.setItem(this.identityKey, id);
      if (localStorage.getItem(this.identityKey) !== id) throw new Error("storage");
    } catch {
      this.state.error = "Allow this site to save browser data before creating a new Squad profile.";
      this.onChange(); return;
    }
    this.deviceId = id; this.token = token;
    this.setMembership(null);
    Object.assign(this.state, emptySquadState());
    await this.refresh();
  }

  private setMembership(club: number | null): void {
    this.state.myClubId = club;
    if (this.chatClub !== club) {
      this.membershipEpoch++;
      this.chatClub = club;
      this.state.chat = []; this.lastChatId = 0;
    }
  }

  private recordError(error: unknown, fallback: string): void {
    if (error instanceof SquadError && (error.status === 401 || error.status === 403) && !this.state.registered) {
      this.state.credentialError = true;
      this.state.error = "This browser cannot unlock the saved Squad profile. Its private key may be missing or from an older version.";
    } else this.state.error = error instanceof Error ? error.message : fallback;
  }

  private call<T>(path: string, init?: RequestInit): Promise<T> { return call<T>(path, this.token, init, this.lifetime.signal); }

  /** Honest one-liner for a directory hit: when the record was last updated. */
  private describeDirectoryHit(found: DirectoryPilot, seenMs: number): string {
    const parts = ["Found in the platform pilot directory"];
    if (found.bestDistance > 0) parts.push(`best ${Math.round(found.bestDistance).toLocaleString()} m`);
    if (seenMs > 0) {
      const mins = Math.round(seenMs / 60000);
      parts.push(mins < 60 ? `updated ${Math.max(1, mins)} min ago` : `updated ${Math.round(mins / 60)} h ago`);
    }
    parts.push("wingman requests need the online service");
    return parts.join(" · ");
  }

  /**
   * Publish this device's own public record (name + best distance) so other
   * players can find the code. Only the platform edition has a directory, and
   * only the device's own code is ever written.
   */
  async publishDirectoryRecord(stats: { bestDistance: number; skin: string }): Promise<boolean> {
    if (!directoryAvailable() || !this.state.myCode) return false;
    const ok = await publishPilot({
      code: this.state.myCode,
      name: this.nameOf(),
      bestDistance: stats.bestDistance,
      skin: stats.skin,
    });
    return ok;
  }

  private async mutate<T>(work: () => Promise<T>, fallback: T): Promise<T> {
    if (this.lifetime.signal.aborted || this.state.busy || this.state.loading) return fallback;
    this.state.busy = true;
    this.state.error = "";
    this.onChange();
    try { return await work(); }
    finally { this.state.busy = false; this.onChange(); }
  }

  get live(): boolean {
    return this.state.live;
  }

  setPage(kind: string, page: number): void {
    const next = Math.max(0, Math.floor(page) || 0);
    if (kind === "friends") this.state.friendPage = next;
    if (kind === "clubs") this.state.clubPage = next;
    this.onChange();
  }

  /** Latest numbers for the public record; set by the game each save change. */
  private publishStats: { bestDistance: number; skin: string } | null = null;

  setOnChange(fn: () => void): void {
    this.onChange = fn;
  }

  /** Register + load profile & clubs. Called when the Squad screen opens. */
  async refresh(): Promise<void> {
    if (this.isAutonomous) {
      this.enableAutonomous();
      this.publishSelf();
      return;
    }
    if (this.state.busy) return; // a mutation owns its reconciliation
    await this.load();
    this.publishSelf();
  }

  /** Ask the game for this pilot's current mark and republish the record. */
  private publishSelf(): void {
    if (!directoryAvailable()) return;
    this.publishStats ??= { bestDistance: 0, skin: "" };
    void this.publishDirectoryRecord(this.publishStats);
  }

  /** The game hands over the numbers only it knows (best distance, skin). */
  setPublishStats(stats: { bestDistance: number; skin: string }): void {
    this.publishStats = stats;
  }

  private async load(): Promise<void> {
    // No social service in this build: portal editions blank VITE_SOCIAL_URL,
    // so `${API}${path}` would be a *relative* fetch against whatever origin
    // hosts the game — on Poki that is a 404 in the Inspector's Warnings tab
    // and a console error for the player. Stay in the honest offline state
    // (live UI shows "unavailable") instead of asking a host that has no such
    // endpoint.
    if (this.lifetime.signal.aborted || !this.state.live || this.state.loading || !API) return;
    this.state.loading = true;
    this.state.error = "";
    this.onChange();
    try {
      const reg = await this.call<{ code: string }>("/register", {
        method: "POST",
        body: JSON.stringify({ deviceId: this.deviceId, name: this.nameOf() }),
      });
      if (typeof reg.code !== "string" || !reg.code.startsWith("SUN-")) throw new Error("Squad returned an invalid friend code. Try Refresh.");
      this.state.registered = true;
      this.state.credentialError = false;
      this.state.myCode = reg.code;
      const [profile, clubs, requests] = await Promise.all([
        this.call<{ friends: Wingman[]; clubId: number | null }>(`/profile?device=${encodeURIComponent(this.deviceId)}`),
        this.call<{ clubs: Club[]; mine: number | null }>(`/clubs?device=${encodeURIComponent(this.deviceId)}`),
        this.call<{ incoming: PilotRequest[]; outgoing: PilotRequest[] }>(`/friends/requests?device=${encodeURIComponent(this.deviceId)}`),
      ]);
      this.state.requestsIn = Array.isArray(requests.incoming) ? requests.incoming : [];
      this.state.requestsOut = Array.isArray(requests.outgoing) ? requests.outgoing : [];
      this.state.friends = Array.isArray(profile.friends)
        ? profile.friends.filter((f) => typeof f?.name === "string" && f.name.trim().length > 0)
        : [];
      if (profile.clubId !== null && (!Number.isSafeInteger(profile.clubId) || profile.clubId < 1)) throw new Error("Squad returned invalid membership data. Try Refresh.");
      this.setMembership(profile.clubId);
      this.state.clubs = Array.isArray(clubs.clubs) ? clubs.clubs.filter(c => Number.isSafeInteger(c?.id) && typeof c.name === "string" && typeof c.motto === "string" && Number.isFinite(c.members)) : [];
      if (this.state.myClubId) await this.pollChat(true);
    } catch (err) {
      this.recordError(err, "Social server unreachable");
    } finally {
      this.state.loading = false;
      this.onChange();
    }
  }

  /** True when a pilot directory is actually reachable from this build. */
  hasService(): boolean {
    return Boolean(API) && !this.isAutonomous;
  }

  /** Straight from the panel's search box. */
  setPilotQuery(query: string): void {
    this.state.pilotQuery = query;
    this.onChange();
  }

  /**
   * Look a pilot up by their exact code.
   *
   * This is the honest core of the panel. Three outcomes are possible and all
   * three are shown to the player verbatim:
   *   • the service knows the code  → a card with the real name, club, best
   *     distance, rank and presence;
   *   • the service does not know it → "no pilot with that code";
   *   • there is no service (offline/portal build) → "unavailable", with the
   *     local, real sources offered instead.
   * A code is NEVER turned into a name locally. That fabrication ("Wingman-
   * 9F3K") is gone for good.
   */
  async lookupPilot(raw: string): Promise<PilotLookup> {
    const query = raw.trim().toUpperCase();
    this.state.pilotQuery = query;
    const fail = (status: PilotLookup["status"], message: string): PilotLookup => ({
      status,
      query,
      name: "",
      code: "",
      online: false,
      club: "",
      bestDistance: 0,
      rank: 0,
      friend: false,
      outgoing: false,
      incoming: false,
      message,
    });

    if (!/^SUN-[A-Z0-9]{6}$/.test(query)) {
      const result = fail("unknown", "Pilot codes look like SUN-9F3K2A — check the code and try again.");
      this.state.lookup = result;
      this.onChange();
      return result;
    }

    if (!this.hasService()) {
      // No self-hosted social service in this build. On the platform edition
      // there is still a real directory — the public pilot records other
      // players published under their codes — so try that before saying
      // "unavailable". A code that is not there is reported as unknown; a code
      // is never turned into a name locally.
      if (directoryAvailable()) {
        const found = await lookupDirectoryPilot(query);
        if (this.lifetime.signal.aborted) return fail("unavailable", "");
        if (found) {
          const seen = found.at > 0 ? Math.max(0, Date.now() - found.at) : 0;
          const result: PilotLookup = {
            status: "ok",
            query,
            name: found.name || "A pilot",
            code: found.code,
            // The directory is storage, not presence: it cannot tell whether
            // someone is flying right now, so it does not pretend to.
            online: false,
            club: "",
            bestDistance: found.bestDistance,
            rank: 0,
            friend: this.state.friends.some((f) => f.code === found.code),
            outgoing: this.state.requestsOut.some((r) => r.code === found.code),
            incoming: this.state.requestsIn.some((r) => r.code === found.code),
            message: this.describeDirectoryHit(found, seen),
          };
          this.state.lookup = result;
          this.onChange();
          return result;
        }
        const unknown = fail("unknown", `No pilot has published the code ${query}. Codes are case-insensitive — check it and try again.`);
        this.state.lookup = unknown;
        this.onChange();
        return unknown;
      }
      // Neither a social service nor a directory: say exactly that, and point
      // at the real list of pilots this device has actually flown with.
      const result = fail(
        "unavailable",
        "Pilot lookup needs the online service, which this build does not have. Pilots you have actually raced with are listed below.",
      );
      this.state.lookup = result;
      this.onChange();
      return result;
    }

    this.state.lookupBusy = true;
    this.onChange();
    try {
      const res = await this.call<{
        pilot: {
          name: string;
          code: string;
          online: boolean;
          club: { name: string } | null;
          bestDistance: number;
          rank: number;
          friend: boolean;
          outgoing: boolean;
          incoming: boolean;
          self: boolean;
        };
      }>(`/players/${encodeURIComponent(query)}`);
      const p = res.pilot;
      if (p.self) {
        const result = fail("self", "That is your own pilot code — share it so others can find you.");
        result.name = p.name;
        result.code = p.code;
        this.state.lookup = result;
        return result;
      }
      const result: PilotLookup = {
        status: "ok",
        query,
        name: p.name,
        code: p.code,
        online: Boolean(p.online),
        club: p.club?.name ?? "",
        bestDistance: Math.max(0, Math.round(Number(p.bestDistance) || 0)),
        rank: Math.max(0, Math.round(Number(p.rank) || 0)),
        friend: Boolean(p.friend),
        outgoing: Boolean(p.outgoing),
        incoming: Boolean(p.incoming),
        message: "",
      };
      this.state.lookup = result;
      return result;
    } catch (err) {
      // Structural check: the status is what matters, not which error class
      // carried it (fetch layers and tests both produce plain Error objects).
      const status = (err as { status?: number })?.status === 404 ? "unknown" : "error";
      const result = fail(
        status,
        status === "unknown"
          ? `No pilot has the code ${query}. Codes are shown on a pilot's own Squad screen.`
          : "Could not reach the pilot directory. Try again in a moment.",
      );
      this.state.lookup = result;
      return result;
    } finally {
      this.state.lookupBusy = false;
      this.onChange();
    }
  }

  /**
   * Send a wingman request for a looked-up pilot. Returns the notice line for
   * the panel; the friend list itself only changes when the other pilot
   * accepts (see {@link respondRequest}), which is now stated honestly instead
   * of claiming "added!" for a request that is still pending.
   */
  async addFriend(code: string): Promise<string> {
    const clean = code.trim().toUpperCase();
    if (!clean) return "";
    if (!this.hasService()) {
      this.state.error =
        "Wingman requests need the online service, which this build does not have. You can still see and save the pilots you have actually raced with, below.";
      this.onChange();
      return this.state.error;
    }
    return this.mutate(async () => {
      try {
        const r = await this.call<{
          status: "requested" | "accepted" | "friends" | "pending";
          friend: { name: string; code: string };
        }>("/friends/add", { method: "POST", body: JSON.stringify({ deviceId: this.deviceId, code: clean }) });
        await this.load();
        if (r.status === "friends") return `🪽 ${r.friend.name} is already a wingman.`;
        if (r.status === "accepted") return `🪽 ${r.friend.name} had asked you first — added!`;
        return `📨 Request sent to ${r.friend.name}. They will see it under Wingmen → Requests.`;
      } catch (err) {
        if ((err as { status?: number })?.status === 404) {
          this.state.error = `No pilot has the code ${clean}.`;
          this.onChange();
          return "";
        }
        this.recordError(err, "Could not send the wingman request");
        return "";
      }
    }, "");
  }

  /** Local wingmen (met in a race, no code to verify) live in localStorage. */
  private persistLocalFriends(): void {
    try {
      localStorage.setItem("sunbird.squad.local_friends", JSON.stringify(this.state.friends.filter((f) => !f.code)));
    } catch {
      /* memory-only session */
    }
  }

  /** Accept or decline an incoming request. */
  async respondRequest(requestId: string, accept: boolean): Promise<void> {
    if (!this.hasService() || !requestId) return;
    return this.mutate(async () => {
      try {
        await this.call("/friends/respond", { method: "POST", body: JSON.stringify({ requestId, accept }) });
      } catch (err) {
        this.recordError(err, "Could not update that request");
        return;
      }
      await this.load();
    }, undefined);
  }

  /** Withdraw a request you sent. */
  async cancelRequest(requestId: string): Promise<void> {
    if (!this.hasService() || !requestId) return;
    return this.mutate(async () => {
      try {
        await this.call("/friends/cancel", { method: "POST", body: JSON.stringify({ requestId }) });
      } catch (err) {
        this.recordError(err, "Could not cancel that request");
        return;
      }
      await this.load();
    }, undefined);
  }

  /**
   * Save a pilot this device has really flown with as a wingman. These come
   * from {@link PilotBook}, i.e. from real room rosters, so the name is real
   * even though there is no code to verify.
   */
  rememberWingman(name: string): string {
    const clean = name.trim();
    if (!clean) return "";
    if (this.state.friends.some((f) => f.name.toLowerCase() === clean.toLowerCase())) {
      return `${clean} is already in your wingmen.`;
    }
    this.state.friends = [...this.state.friends, { name: clean, code: "", club_id: null, local: true } as Wingman];
    this.persistLocalFriends();
    this.onChange();
    return `🪽 ${clean} saved to your wingmen (met in a race).`;
  }

  async removeFriend(ref: string): Promise<void> {
    // `ref` is a pilot code for verified wingmen, or a name for the local ones
    // saved from a race (they never had a code to share).
    const isCode = /^SUN-[A-Z0-9]{6}$/.test(ref.trim().toUpperCase());
    if (this.isAutonomous) {
      this.state.friends = this.state.friends.filter((f) =>
        isCode ? f.code !== ref.trim().toUpperCase() : f.name.toLowerCase() !== ref.trim().toLowerCase(),
      );
      this.persistLocalFriends();
      this.onChange();
      return;
    }
    return this.mutate(async () => {
      try {
        await this.call("/friends/remove", { method: "POST", body: JSON.stringify({ deviceId: this.deviceId, code: ref }) });
      } catch {
        this.state.error = "Could not remove this friend. Try again.";
        return;
      }
      await this.load();
    }, undefined);
  }

  async createClub(name: string, motto: string): Promise<string> {
    if (this.isAutonomous) {
      const newClub: Club = { id: Date.now(), name, motto, members: 1 };
      this.state.clubs.unshift(newClub);
      this.setMembership(newClub.id);
      this.state.chat = [{ id: 1, name: this.nameOf(), text: `Founded ${name}! Ready for formation flights.`, at: "just now" }];
      try {
        localStorage.setItem("sunbird.squad.local_clubs", JSON.stringify(this.state.clubs));
        localStorage.setItem("sunbird.squad.local_club_id", String(newClub.id));
        localStorage.setItem(`sunbird.squad.local_chat.${newClub.id}`, JSON.stringify(this.state.chat));
      } catch {}
      this.onChange();
      return "Club founded!";
    }
    return this.mutate(async () => {
      try {
        const result = await this.call<{ club: Club }>("/clubs/create", {
          method: "POST",
          body: JSON.stringify({ deviceId: this.deviceId, name, motto, playerName: this.nameOf() }),
        });
        if (!Number.isSafeInteger(result.club?.id)) throw new Error("Club created, but details could not be loaded. Try Refresh.");
        this.setMembership(result.club.id);
        this.state.clubs = [{ ...result.club, members: 1 }, ...this.state.clubs.filter(c => c.id !== result.club.id)];
        await this.load();
        return "Club founded!";
      } catch (err) {
        this.recordError(err, "Could not create club");
        return "";
      }
    }, "Another Squad request is still running.");
  }

  async joinClub(clubId: number): Promise<string> {
    if (this.isAutonomous) {
      this.setMembership(clubId);
      let chat: ChatMessage[] = [];
      try {
        const savedChat = localStorage.getItem(`sunbird.squad.local_chat.${clubId}`);
        if (savedChat) chat = JSON.parse(savedChat);
        localStorage.setItem("sunbird.squad.local_club_id", String(clubId));
      } catch {}
      this.state.chat = chat;
      this.onChange();
      return "Joined!";
    }
    return this.mutate(async () => {
      try {
        await this.call("/clubs/join", {
          method: "POST",
          body: JSON.stringify({ deviceId: this.deviceId, clubId, playerName: this.nameOf() }),
        });
        this.setMembership(clubId);
        await this.load();
        return "Joined!";
      } catch (err) {
        this.recordError(err, "Could not join");
        return "";
      }
    }, "Another Squad request is still running.");
  }

  async leaveClub(): Promise<void> {
    if (this.isAutonomous) {
      this.setMembership(null);
      this.state.chat = [];
      try { localStorage.setItem("sunbird.squad.local_club_id", ""); } catch {}
      this.onChange();
      return;
    }
    return this.mutate(async () => {
      try {
        await this.call("/clubs/leave", { method: "POST", body: JSON.stringify({ deviceId: this.deviceId }) });
      } catch {
        this.state.error = "Could not leave the club. Try again.";
        return;
      }
      // The acknowledged leave is authoritative even if the next GET fails.
      this.setMembership(null);
      this.state.chat = []; this.lastChatId = 0;
      await this.load();
    }, undefined);
  }

  async sendChat(text: string): Promise<boolean> {
    // Portal editions have no chat surface (Poki REQ-31), so the send is dead
    // here even if a stale DOM node or a future caller reaches it: no chat
    // endpoint is ever contacted in those builds.
    if (!SQUAD_CHAT) return false;
    const t = text.trim();
    if (!t) return false;
    if (this.isAutonomous) {
      const userMsg: ChatMessage = { id: Date.now(), name: this.nameOf(), text: t, at: "just now" };
      this.state.chat.push(userMsg);
      const clubId = this.state.myClubId;
      if (clubId) {
        try { localStorage.setItem(`sunbird.squad.local_chat.${clubId}`, JSON.stringify(this.state.chat)); } catch {}
      }
      this.onChange();

      // No replies are invented. This used to schedule a "wingmate" answer
      // drawn at random from a canned list, filed into the same message array
      // as the player's own and rendered under their name — a fabricated club
      // member answering a message no one received. It contradicted the rule
      // stated at the top of this module ("Wingmen are only ever real pilots
      // this device verified"), and a chat pane that invents the other side is
      // worse than one that stays quiet. The offline hub stores what you said
      // and nothing else.

      return true;
    }
    return this.mutate(async () => {
      this.state.error = "";
      try {
        const club = this.state.myClubId, epoch = this.membershipEpoch;
        const result = await this.call<{ message?: ChatMessage }>("/chat", { method: "POST", body: JSON.stringify({ deviceId: this.deviceId, text: t }) });
        const message = result.message;
        if (club === this.state.myClubId && epoch === this.membershipEpoch && message && Number.isSafeInteger(message.id) && typeof message.name === "string" && typeof message.text === "string") {
          const merged = new Map(this.state.chat.map(m => [m.id, m]));
          merged.set(message.id, message);
          this.state.chat = [...merged.values()].sort((a, b) => a.id - b.id).slice(-50);
          // Do not advance the poll cursor past unread messages from peers.
        }
        await this.pollChat(false);
        return true;
      } catch {
        this.state.error = "Message not sent. Check your connection and try again.";
        return false;
      }
    }, false);
  }

  async pollChat(reset: boolean): Promise<void> {
    if (!SQUAD_CHAT) return;
    if (this.isAutonomous) return;
    const club = this.state.myClubId;
    if (this.lifetime.signal.aborted || !club || this.polling) return;
    const epoch = this.membershipEpoch;
    this.polling = true;
    try {
      const r = await this.call<{ messages: ChatMessage[] }>(`/chat?device=${encodeURIComponent(this.deviceId)}&club=${club}&after=${reset ? 0 : this.lastChatId}`);
      if (this.state.myClubId !== club || this.membershipEpoch !== epoch) return; // response from a club we left
      if (!Array.isArray(r.messages)) throw new Error("Invalid chat response");
      const messages = r.messages.filter(m => Number.isSafeInteger(m?.id) && m.id > 0 && typeof m.name === "string" && typeof m.text === "string");
      const merged = new Map(this.state.chat.map(m => [m.id, m]));
      for (const message of messages) merged.set(message.id, message);
      this.state.chat = [...merged.values()].sort((a, b) => a.id - b.id).slice(-50);
      this.lastChatId = Math.max(reset ? 0 : this.lastChatId, ...messages.map(m => m.id));
      const recovered = this.state.error === CHAT_STALE;
      if (recovered) this.state.error = "";
      if (messages.length || recovered) this.onChange();
    } catch {
      if (this.state.myClubId !== club || this.membershipEpoch !== epoch) return;
      this.state.error = CHAT_STALE;
      this.onChange();
    } finally { this.polling = false; }
  }
}
