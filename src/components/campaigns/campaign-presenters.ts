import type { CSSProperties } from "react";

import type { CampaignStatus } from "@/domain/entities";

export const campaignSections = [
  { id: "campaign", number: "01", label: "Campanha", path: "" },
  { id: "overview", number: "02", label: "Visão Geral", path: "/overview" },
  { id: "sheet", number: "03", label: "Ficha", path: "/sheet" },
  { id: "sessions", number: "04", label: "Sessões", path: "/sessions" },
] as const;

export type CampaignSectionId = (typeof campaignSections)[number]["id"];

export function isCampaignSection(
  value: string,
): value is Exclude<CampaignSectionId, "campaign"> {
  return campaignSections.some(
    (section) => section.id !== "campaign" && section.id === value,
  );
}

const campaignStatusLabels: Record<CampaignStatus, string> = {
  draft: "Em preparação",
  recruiting: "Recrutando",
  active: "Em andamento",
  paused: "Pausada",
  completed: "Finalizada",
};

export function campaignStatusLabel(status: CampaignStatus): string {
  return campaignStatusLabels[status];
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function formatDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : "A definir";
}

export function formatDateTime(value: string | null): string {
  return value ? dateTimeFormatter.format(new Date(value)) : "Data não definida";
}

export function campaignInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase("pt-BR"))
    .join("");
}

function safeColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function safeAccentColor(value: string, fallback: string): string {
  const color = safeColor(value, fallback);
  const channels = [1, 3, 5].map((index) =>
    Number.parseInt(color.slice(index, index + 2), 16) / 255,
  );
  const luminance = channels
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (total, channel, index) =>
        total + channel * ([0.2126, 0.7152, 0.0722][index] ?? 0),
      0,
    );
  return luminance >= 0.2 ? color : fallback;
}

export type CampaignThemeStyle = CSSProperties & {
  "--campaign-primary": string;
  "--campaign-secondary": string;
};

export function campaignThemeStyle(
  primaryColor: string,
  secondaryColor: string,
): CampaignThemeStyle {
  return {
    "--campaign-primary": safeAccentColor(primaryColor, "#e8792f"),
    "--campaign-secondary": safeColor(secondaryColor, "#66737d"),
  };
}
