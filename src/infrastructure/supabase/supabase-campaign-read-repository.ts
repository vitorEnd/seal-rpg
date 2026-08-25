import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CampaignAccessView,
  CampaignCardView,
  CampaignExperienceView,
  CampaignMemberView,
  CampaignReadRepository,
  CampaignTeamView,
} from "@/application/campaigns/campaign-read-repository";
import type { EntityId } from "@/domain/entities";
import type { Database } from "@/infrastructure/supabase/database.types";
import {
  mapCampaignMemberRow,
  mapCampaignRow,
  mapUserRow,
} from "@/infrastructure/supabase/supabase-mappers";
import { createSupabaseRepositories } from "@/infrastructure/supabase/supabase-repositories";
import { SupabaseTabletopRepository } from "@/infrastructure/supabase/supabase-tabletop-repository";

function compareCards(left: CampaignCardView, right: CampaignCardView) {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.name.localeCompare(right.name)
  );
}

export class SupabaseCampaignReadRepository
  implements CampaignReadRepository
{
  constructor(private readonly client: SupabaseClient<Database>) {}

  private repositories() {
    const tabletop = new SupabaseTabletopRepository(this.client);
    return createSupabaseRepositories(this.client, tabletop);
  }

  async listCampaignCards(): Promise<CampaignCardView[]> {
    const { data, error } = await this.client.rpc("list_public_campaign_cards");
    if (error) throw error;

    return (data ?? [])
      .map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        shortDescription: row.short_description,
        genre: row.genre,
        status: row.status as CampaignCardView["status"],
        coverImageUrl: row.cover_image_url,
        backgroundImageUrl: row.background_image_url,
        primaryColor: row.primary_color,
        secondaryColor: row.secondary_color,
        playerCount: Number(row.player_count ?? 0),
        updatedAt: row.updated_at,
      }))
      .sort(compareCards);
  }

  async listCampaignCardsForUser(
    userId: EntityId,
  ): Promise<CampaignCardView[]> {
    const cards = await this.listCampaignCards();

    const { data: profile, error: profileError } = await this.client
      .from("profiles")
      .select("role,status")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (profile?.status !== "active") return [];
    if (profile.role === "admin") return cards;

    const { data: memberships, error: membershipError } = await this.client
      .from("campaign_members")
      .select("campaign_id,status")
      .eq("user_id", userId);

    if (membershipError) throw membershipError;

    const { data: managedCampaigns, error: campaignError } = await this.client
      .from("campaigns")
      .select("id")
      .eq("game_master_user_id", userId);

    if (campaignError) throw campaignError;

    const allowed = new Set<string>();

    for (const membership of memberships ?? []) {
      if (membership.status === "approved") {
        allowed.add(membership.campaign_id);
      }
    }

    for (const campaign of managedCampaigns ?? []) {
      allowed.add(campaign.id);
    }

    return cards.filter((card) => allowed.has(card.id));
  }

  async findCampaignAccessBySlug(
    slug: string,
    userId: EntityId,
  ): Promise<CampaignAccessView | null> {
    const { data: campaignRow, error: campaignError } = await this.client
      .from("campaigns")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (campaignError) throw campaignError;
    if (!campaignRow) return null;

    const { data: membershipRow, error: membershipError } = await this.client
      .from("campaign_members")
      .select("*")
      .eq("campaign_id", campaignRow.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) throw membershipError;

    return {
      campaign: mapCampaignRow(campaignRow),
      membership: membershipRow
        ? mapCampaignMemberRow(membershipRow)
        : null,
    };
  }

  async findCampaignExperienceBySlug(
    slug: string,
  ): Promise<CampaignExperienceView | null> {
    const repositories = this.repositories();
    const campaign = await repositories.campaigns.findBySlug(slug);
    if (!campaign) return null;

    const [
      memberships,
      characters,
      chapters,
      statuses,
      classes,
      teams,
      missions,
      sessions,
      events,
      files,
      openTable,
    ] = await Promise.all([
      repositories.campaignMembers.listByCampaign(campaign.id),
      repositories.characters.listByCampaign(campaign.id),
      repositories.campaignChapters.listByCampaign(campaign.id),
      repositories.characterStatusOptions.listByCampaign(campaign.id),
      repositories.characterClassOptions.listByCampaign(campaign.id),
      repositories.teams.listByCampaign(campaign.id),
      repositories.missions.listByCampaign(campaign.id),
      repositories.campaignSessions.listByCampaign(campaign.id),
      repositories.campaignEvents.listByCampaign(campaign.id),
      repositories.files.listByCampaign(campaign.id),
      repositories.tabletop.findOpenByCampaign(campaign.id),
    ]);

    const profileIds = new Set<string>();

    for (const membership of memberships) {
      profileIds.add(membership.userId);
    }

    if (campaign.gameMasterUserId) {
      profileIds.add(campaign.gameMasterUserId);
    }

    const profiles = await Promise.all(
      [...profileIds].map(async (id) => {
        const { data, error } = await this.client
          .from("profiles")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return data ? mapUserRow(data) : null;
      }),
    );

    const usersById = new Map(
      profiles
        .filter((user): user is NonNullable<typeof user> => Boolean(user))
        .map((user) => [user.id, user]),
    );

    const members: CampaignMemberView[] = memberships
      .slice()
      .sort(
        (left, right) =>
          Number(right.role === "game_master") -
            Number(left.role === "game_master") ||
          left.joinedAt.localeCompare(right.joinedAt),
      )
      .map((membership) => ({
        membership,
        user: usersById.get(membership.userId) ?? null,
      }));

    const charactersById = new Map(
      characters.map((character) => [character.id, character]),
    );

    const teamViews: CampaignTeamView[] = await Promise.all(
      teams
        .slice()
        .sort(
          (left, right) =>
            left.order - right.order || left.name.localeCompare(right.name),
        )
        .map(async (team) => {
          const teamMemberships =
            await repositories.teamMembers.listByTeam(team.id);

          const teamCharacters = teamMemberships
            .slice()
            .sort((left, right) => left.order - right.order)
            .flatMap((membership) => {
              const character = charactersById.get(membership.characterId);
              return character ? [character] : [];
            });

          return { team, members: teamCharacters };
        }),
    );

    return {
      campaign,
      openTableSessionId: openTable?.sessionId ?? null,
      gameMaster:
        (campaign.gameMasterUserId
          ? usersById.get(campaign.gameMasterUserId)
          : undefined) ??
        members.find(
          (member) =>
            member.membership.role === "game_master" &&
            member.membership.status === "approved",
        )?.user ??
        null,
      members,
      characters: characters
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name)),
      chapters: chapters
        .slice()
        .sort(
          (left, right) =>
            left.order - right.order || left.title.localeCompare(right.title),
        ),
      characterStatusOptions: statuses
        .slice()
        .sort(
          (left, right) =>
            left.order - right.order || left.name.localeCompare(right.name),
        ),
      characterClassOptions: classes
        .slice()
        .sort(
          (left, right) =>
            left.order - right.order || left.name.localeCompare(right.name),
        ),
      teams: teamViews,
      missions: missions
        .slice()
        .sort(
          (left, right) =>
            left.order - right.order ||
            left.missionNumber - right.missionNumber,
        ),
      sessions: sessions.slice().sort((left, right) => {
        const leftDate =
          left.occurredAt ?? left.scheduledAt ?? left.createdAt;
        const rightDate =
          right.occurredAt ?? right.scheduledAt ?? right.createdAt;

        return rightDate.localeCompare(leftDate);
      }),
      events: events
        .slice()
        .sort(
          (left, right) =>
            left.order - right.order ||
            left.occurredAt.localeCompare(right.occurredAt),
        ),
      files: files
        .slice()
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    };
  }
}
