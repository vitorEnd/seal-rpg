import type {
  Campaign,
  CampaignMember,
  Character,
  ContentVisibility,
  User,
  UserRole,
  VirtualTableToken,
} from "@/domain/entities";

export function hasGlobalRole(user: User, roles: readonly UserRole[]): boolean {
  return user.status === "active" && roles.includes(user.role);
}

export function canManageCampaign(
  user: User,
  campaign: Campaign,
  membership: CampaignMember | null,
): boolean {
  if (user.status !== "active") {
    return false;
  }

  if (user.role === "admin" || campaign.gameMasterUserId === user.id) {
    return true;
  }

  return (
    user.role === "game_master" &&
    membership?.status === "approved" &&
    membership.role === "game_master"
  );
}

export function canViewCampaign(
  user: User,
  campaign: Campaign,
  membership: CampaignMember | null,
): boolean {
  if (user.status !== "active") {
    return false;
  }

  return (
    user.role === "admin" ||
    campaign.gameMasterUserId === user.id ||
    membership?.status === "approved"
  );
}

export function canViewContent(
  visibility: ContentVisibility,
  user: User | null,
  membership: CampaignMember | null,
): boolean {
  if (visibility === "public") {
    return true;
  }

  if (!user || user.status !== "active") {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  if (visibility === "admin") {
    return false;
  }

  const isApprovedMember = membership?.status === "approved";

  if (visibility === "members") {
    return isApprovedMember;
  }

  return isApprovedMember && membership.role === "game_master";
}

export function canControlVirtualTableToken(
  user: User,
  campaign: Campaign,
  membership: CampaignMember | null,
  token: VirtualTableToken,
  character: Character | null,
): boolean {
  if (canManageCampaign(user, campaign, membership)) {
    return true;
  }

  return (
    canViewCampaign(user, campaign, membership) &&
    token.visible &&
    token.characterId !== null &&
    character?.id === token.characterId &&
    character.userId === user.id
  );
}
