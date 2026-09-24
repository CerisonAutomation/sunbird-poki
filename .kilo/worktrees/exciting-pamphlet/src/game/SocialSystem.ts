/* Social System — Local-first friend, club, DM, and challenge system */

import { dateSeed } from "./math";
import { SeededRandom } from "./math";
import type { SaveData } from "./SaveData";

export type FriendStatus = "pending_out" | "pending_in" | "accepted" | "blocked";
export type FriendEntry = {
  deviceId: string; name: string; skin: string; addedAt: string;
  status: FriendStatus; lastSeen: string; bestDistance: number; bestScore: number;
};
export type ClubRole = "owner" | "officer" | "member";
export type ClubMember = {
  deviceId: string; name: string; role: ClubRole; joinedAt: string;
  contribution: number; lastActive: string;
};
export type ClubDef = {
  id: string; name: string; tagline: string; emblem: string; maxMembers: number;
  createdAt: string; founderDeviceId: string; members: ClubMember[];
  weeklyChallenge: ClubChallenge; chatLog: ClubMessage[];
};
export type ClubChallenge = {
  weekKey: string; goalKind: "total_distance" | "total_coins" | "total_perfects" | "total_islands";
  goalTarget: number; progress: number; claimed: boolean; rewardTier: 0 | 1 | 2 | 3;
};
export type ClubMessage = { senderId: string; senderName: string; text: string; timestamp: number };
export type DmMessage = { fromDeviceId: string; text: string; timestamp: number; read: boolean };
export type DmThread = { peerDeviceId: string; peerName: string; messages: DmMessage[]; lastMessageAt: number; unreadCount: number };
export type ChallengeStatus = "pending" | "accepted" | "completed" | "expired";
export type FriendChallenge = {
  id: string; challengerId: string; challengerName: string; targetId: string;
  challengeKind: "distance" | "score" | "altitude" | "perfects";
  challengerValue: number; ghostSeed: string; ghostDistance: number;
  targetValue: number | null; status: ChallengeStatus; createdAt: string;
  expiresAt: string; result?: "won" | "lost" | "tied";
};
export type ReplayData = {
  seed: string; distance: number; score: number; coins: number;
  skinId: string; playerName: string;
  samples: [number, number, number, number][]; highlights: ReplayHighlight[];
};
export type ReplayHighlight = { t: number; kind: string; label: string };
export type SocialState = {
  friends: FriendEntry[]; pendingRequests: string[]; incomingRequests: string[];
  blocked: string[]; club: ClubDef | null; dmThreads: DmThread[];
  challenges: FriendChallenge[]; savedReplays: ReplayData[]; socialQuestsClaimed: string[];
};

/** A fresh, empty social state — shared so SaveData can default/migrate it. */
export function emptySocialState(): SocialState {
  return {
    friends: [],
    pendingRequests: [],
    incomingRequests: [],
    blocked: [],
    club: null,
    dmThreads: [],
    challenges: [],
    savedReplays: [],
    socialQuestsClaimed: [],
  };
}

export class SocialSystem {
  constructor(private save: SaveData) {}
  private ensureInit(): void {
    if (!this.save.state.social) {
      this.save.state.social = emptySocialState();
      this.save.persist();
    }
  }
  private get social(): SocialState { this.ensureInit(); return this.save.state.social!; }
  sendFriendRequest(targetDeviceId: string, targetName: string): boolean {
    const s = this.social;
    if (targetDeviceId === this.save.state.deviceId) return false;
    if (s.friends.some(f => f.deviceId === targetDeviceId)) return false;
    s.friends.push({ deviceId: targetDeviceId, name: targetName, skin: "sunbird", addedAt: dateSeed(),
      status: "pending_out", lastSeen: dateSeed(), bestDistance: 0, bestScore: 0 });
    s.pendingRequests.push(targetDeviceId);
    this.save.persist(); return true;
  }
  acceptFriendRequest(fromDeviceId: string): boolean {
    const s = this.social;
    const entry = s.friends.find(f => f.deviceId === fromDeviceId && f.status === "pending_in");
    if (!entry) return false;
    entry.status = "accepted"; entry.addedAt = dateSeed();
    s.incomingRequests = s.incomingRequests.filter(id => id !== fromDeviceId);
    this.save.persist(); return true;
  }
  removeFriend(deviceId: string): void { this.social.friends = this.social.friends.filter(f => f.deviceId !== deviceId); this.save.persist(); }
  getFriends(): FriendEntry[] { return this.social.friends.filter(f => f.status === "accepted"); }
  createClub(name: string, tagline: string, emblem: string): ClubDef | null {
    const s = this.social; if (s.club) return null;
    const club: ClubDef = { id: `club_${Date.now().toString(36)}`, name: name.slice(0, 20),
      tagline: tagline.slice(0, 60), emblem: emblem || "🐦", maxMembers: 30, createdAt: dateSeed(),
      founderDeviceId: this.save.state.deviceId,
      members: [{ deviceId: this.save.state.deviceId, name: this.save.state.pilotName || "Pilot", role: "owner",
        joinedAt: dateSeed(), contribution: 0, lastActive: dateSeed() }],
      weeklyChallenge: this.makeWeeklyChallenge(), chatLog: [] };
    s.club = club; this.save.persist(); return club;
  }
  leaveClub(): void { this.social.club = null; this.save.persist(); }
  sendClubChat(text: string): void {
    const club = this.social.club; if (!club || !text.length) return;
    club.chatLog.push({ senderId: this.save.state.deviceId, senderName: this.save.state.pilotName || "Pilot",
      text: text.slice(0, 200), timestamp: Date.now() });
    if (club.chatLog.length > 100) club.chatLog.splice(0, club.chatLog.length - 100);
    this.save.persist();
  }
  contributeToClubChallenge(amount: number): void {
    const club = this.social.club; if (!club) return;
    const ch = club.weeklyChallenge;
    if (ch.weekKey !== this.currentWeekKey()) Object.assign(ch, this.makeWeeklyChallenge());
    ch.progress += amount;
    const me = club.members.find(m => m.deviceId === this.save.state.deviceId);
    if (me) { me.contribution += amount; me.lastActive = dateSeed(); }
    this.save.persist();
  }
  sendDm(targetDeviceId: string, targetName: string, text: string): void {
    const s = this.social;
    let thread = s.dmThreads.find(t => t.peerDeviceId === targetDeviceId);
    if (!thread) { thread = { peerDeviceId: targetDeviceId, peerName: targetName, messages: [], lastMessageAt: 0, unreadCount: 0 }; s.dmThreads.push(thread); }
    thread.messages.push({ fromDeviceId: this.save.state.deviceId, text: text.slice(0, 500), timestamp: Date.now(), read: true });
    thread.lastMessageAt = Date.now();
    if (thread.messages.length > 200) thread.messages.splice(0, thread.messages.length - 200);
    this.save.persist();
  }
  getDmThreads(): DmThread[] { return [...this.social.dmThreads].sort((a, b) => b.lastMessageAt - a.lastMessageAt); }
  createChallenge(targetDeviceId: string, _targetName: string, kind: FriendChallenge["challengeKind"], value: number, ghostSeed: string, ghostDistance: number): FriendChallenge | null {
    const s = this.social;
    if (s.challenges.some(c => c.targetId === targetDeviceId && c.status === "pending")) return null;
    const challenge: FriendChallenge = { id: `ch_${Date.now().toString(36)}`, challengerId: this.save.state.deviceId,
      challengerName: this.save.state.pilotName || "Pilot", targetId: targetDeviceId, challengeKind: kind,
      challengerValue: value, ghostSeed, ghostDistance, targetValue: null, status: "pending",
      createdAt: dateSeed(), expiresAt: this.dateSeedDaysLater(3) };
    s.challenges.push(challenge); this.save.persist(); return challenge;
  }
  /** Accept a pending challenge so a finished run can complete it. */
  acceptChallenge(challengeId: string): boolean {
    const ch = this.social.challenges.find(c => c.id === challengeId);
    if (!ch || ch.status !== "pending") return false;
    if (this.isExpired(ch)) { ch.status = "expired"; this.save.persist(); return false; }
    ch.status = "accepted"; this.save.persist(); return true;
  }
  completeChallenge(challengeId: string, myValue: number): "won" | "lost" | "tied" | null {
    const ch = this.social.challenges.find(c => c.id === challengeId);
    if (!ch || ch.status !== "accepted") return null;
    ch.status = "completed";
    const result: "won" | "lost" | "tied" = myValue > ch.challengerValue ? "won" : myValue < ch.challengerValue ? "lost" : "tied";
    ch.result = result; this.save.persist(); return result;
  }
  getActiveChallenges(): FriendChallenge[] {
    // Sweep expiries lazily so stale challenges never linger as "active".
    let dirty = false;
    for (const c of this.social.challenges) {
      if ((c.status === "pending" || c.status === "accepted") && this.isExpired(c)) { c.status = "expired"; dirty = true; }
    }
    if (dirty) this.save.persist();
    return this.social.challenges.filter(c => c.status === "pending" || c.status === "accepted");
  }
  private isExpired(c: FriendChallenge): boolean { return c.expiresAt < dateSeed(); }
  saveReplay(data: ReplayData): void { const s = this.social; s.savedReplays.unshift(data); if (s.savedReplays.length > 10) s.savedReplays.splice(10); this.save.persist(); }
  getReplays(): ReplayData[] { return this.social.savedReplays; }
  private makeWeeklyChallenge(): ClubChallenge {
    const rng = new SeededRandom(`${this.currentWeekKey()}:club_ch`);
    const kinds: ClubChallenge["goalKind"][] = ["total_distance", "total_coins", "total_perfects", "total_islands"];
    return { weekKey: this.currentWeekKey(), goalKind: kinds[rng.int(0, kinds.length)], goalTarget: 10000 + rng.int(0, 40000), progress: 0, claimed: false, rewardTier: 0 };
  }
  private currentWeekKey(): string { const d = new Date(); const day = (d.getDay() + 6) % 7; const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day); return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`; }
  private dateSeedDaysLater(days: number): string { const d = new Date(Date.now() + days * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
}
