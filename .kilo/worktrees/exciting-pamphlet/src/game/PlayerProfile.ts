export type PrivacySettings = {
  showOnLeaderboards: boolean;
  allowFriendRequests: boolean;
  allowInvites: boolean;
  showPresence: boolean;
};

export type ModerationState = {
  status: "clear" | "muted" | "suspended";
  reasonCode?: string;
};

export type PlayerProfile = {
  playerId: string;
  displayName: string;
  avatarUrl?: string;
  guest: boolean;
  countryCode?: string;
  createdAt: string;
  updatedAt: string;
  privacy: PrivacySettings;
  moderation: ModerationState;
};

export function defaultProfile(playerId: string, name = "Sunbird Pilot"): PlayerProfile {
  const now = new Date().toISOString();
  return {
    playerId,
    displayName: name,
    guest: true,
    createdAt: now,
    updatedAt: now,
    privacy: {
      showOnLeaderboards: true,
      allowFriendRequests: true,
      allowInvites: true,
      showPresence: true,
    },
    moderation: {
      status: "clear",
    },
  };
}
