import "server-only";

import type {
  CampaignAccessView,
  CampaignCardView,
  CampaignExperienceView,
  CampaignMemberView,
  CampaignReadRepository,
  CampaignTeamView,
} from "@/application/campaigns/campaign-read-repository";
import type { EntityId } from "@/domain/entities";
import { JsonDatabase } from "@/infrastructure/local/json-database";
import type { LocalDatabase } from "@/infrastructure/local/local-database.types";

function compareByUpdatedAt(left: CampaignCardView, right: CampaignCardView) {
  return right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name);
}

function buildCards(database: LocalDatabase): CampaignCardView[] {
  return database.campaigns
    .map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      slug: campaign.slug,
      shortDescription: campaign.shortDescription,
      genre: campaign.genre,
      status: campaign.status,
      coverImageUrl: campaign.coverImageUrl,
      backgroundImageUrl: campaign.backgroundImageUrl,
      primaryColor: campaign.primaryColor,
      secondaryColor: campaign.secondaryColor,
      playerCount: database.campaignMembers.filter(
        (membership) =>
          membership.campaignId === campaign.id &&
          membership.status === "approved" &&
          membership.role === "player",
      ).length,
      updatedAt: campaign.updatedAt,
    }))
    .sort(compareByUpdatedAt);
}

export class LocalCampaignReadRepository implements CampaignReadRepository {
  constructor(private readonly database: JsonDatabase) {}

  async listCampaignCards(): Promise<CampaignCardView[]> {
    const database = await this.database.read();
    return structuredClone(buildCards(database));
  }

  async listCampaignCardsForUser(userId: EntityId): Promise<CampaignCardView[]> {
    const database = await this.database.read();
    const accessibleCampaignIds = new Set(
      database.campaignMembers
        .filter(
          (membership) =>
            membership.userId === userId && membership.status === "approved",
        )
        .map((membership) => membership.campaignId),
    );

    for (const campaign of database.campaigns) {
      if (campaign.gameMasterUserId === userId) {
        accessibleCampaignIds.add(campaign.id);
      }
    }

    return structuredClone(
      buildCards(database).filter((campaign) => accessibleCampaignIds.has(campaign.id)),
    );
  }

  async findCampaignAccessBySlug(
    slug: string,
    userId: EntityId,
  ): Promise<CampaignAccessView | null> {
    const database = await this.database.read();
    const campaign = database.campaigns.find((item) => item.slug === slug);

    if (!campaign) {
      return null;
    }

    return structuredClone({
      campaign,
      membership:
        database.campaignMembers.find(
          (item) => item.campaignId === campaign.id && item.userId === userId,
        ) ?? null,
    });
  }

  async findCampaignExperienceBySlug(
    slug: string,
  ): Promise<CampaignExperienceView | null> {
    const database = await this.database.read();
    const campaign = database.campaigns.find((item) => item.slug === slug);

    if (!campaign) {
      return null;
    }

    const usersById = new Map(database.users.map((user) => [user.id, user]));
    const characters = database.characters
      .filter((character) => character.campaignId === campaign.id)
      .sort((left, right) => left.name.localeCompare(right.name));
    const charactersById = new Map(
      characters.map((character) => [character.id, character]),
    );
    const members: CampaignMemberView[] = database.campaignMembers
      .filter((membership) => membership.campaignId === campaign.id)
      .sort(
        (left, right) =>
          Number(right.role === "game_master") - Number(left.role === "game_master") ||
          left.joinedAt.localeCompare(right.joinedAt),
      )
      .map((membership) => ({
        membership,
        user: usersById.get(membership.userId) ?? null,
      }));
    const teams: CampaignTeamView[] = database.teams
      .filter((team) => team.campaignId === campaign.id)
      .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
      .map((team) => {
        const memberIds = database.teamMembers
          .filter((membership) => membership.teamId === team.id)
          .sort((left, right) => left.order - right.order)
          .map((membership) => membership.characterId);

        return {
          team,
          members: memberIds.flatMap((id) => {
            const character = charactersById.get(id);
            return character ? [character] : [];
          }),
        };
      });

    const experience: CampaignExperienceView = {
      campaign,
      openTableSessionId:
        database.virtualTables.find(
          (table) => table.campaignId === campaign.id && table.status === "open",
        )?.sessionId ?? null,
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
      characters,
      chapters: database.campaignChapters
        .filter((chapter) => chapter.campaignId === campaign.id)
        .sort(
          (left, right) =>
            left.order - right.order || left.title.localeCompare(right.title),
        ),
      characterStatusOptions: database.characterStatusOptions
        .filter((option) => option.campaignId === campaign.id)
        .sort(
          (left, right) =>
            left.order - right.order || left.name.localeCompare(right.name),
        ),
      characterClassOptions: database.characterClassOptions
        .filter((option) => option.campaignId === campaign.id)
        .sort(
          (left, right) =>
            left.order - right.order || left.name.localeCompare(right.name),
        ),
      teams,
      missions: database.missions
        .filter((mission) => mission.campaignId === campaign.id)
        .sort(
          (left, right) =>
            left.order - right.order || left.missionNumber - right.missionNumber,
        ),
      sessions: database.campaignSessions
        .filter((session) => session.campaignId === campaign.id)
        .sort((left, right) => {
          const leftDate = left.occurredAt ?? left.scheduledAt ?? left.createdAt;
          const rightDate = right.occurredAt ?? right.scheduledAt ?? right.createdAt;
          return rightDate.localeCompare(leftDate);
        }),
      events: database.campaignEvents
        .filter((event) => event.campaignId === campaign.id)
        .sort(
          (left, right) =>
            left.order - right.order || left.occurredAt.localeCompare(right.occurredAt),
        ),
      files: database.files
        .filter((file) => file.campaignId === campaign.id)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    };

    return structuredClone(experience);
  }
}
