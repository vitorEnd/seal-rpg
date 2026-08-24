import type { CampaignChapter } from "@/domain/entities";

export type CampaignChapterProgressState =
  | "completed"
  | "available"
  | "locked";

export interface CampaignChapterProgressEntry {
  chapter: CampaignChapter;
  state: CampaignChapterProgressState;
}

export interface CampaignChapterProgression {
  entries: CampaignChapterProgressEntry[];
  currentChapter: CampaignChapter | null;
  nextChapter: CampaignChapter | null;
  completedCount: number;
  isComplete: boolean;
}

export function compareCampaignChapters(
  left: CampaignChapter,
  right: CampaignChapter,
): number {
  return (
    left.order - right.order ||
    left.title.localeCompare(right.title, "pt-BR") ||
    left.id.localeCompare(right.id)
  );
}

export function resolveCampaignChapterProgression(
  chapters: CampaignChapter[],
): CampaignChapterProgression {
  const published = chapters
    .filter((chapter) => chapter.status === "published")
    .slice()
    .sort(compareCampaignChapters);
  const currentIndex = published.findIndex(
    (chapter) => chapter.completedAt === null,
  );
  const isComplete = published.length > 0 && currentIndex === -1;
  const entries = published.map((chapter, index) => ({
    chapter,
    state:
      currentIndex === -1 || index < currentIndex
        ? ("completed" as const)
        : index === currentIndex
          ? ("available" as const)
          : ("locked" as const),
  }));

  return {
    entries,
    currentChapter: currentIndex === -1 ? null : published[currentIndex],
    nextChapter:
      currentIndex === -1 ? null : published[currentIndex + 1] ?? null,
    completedCount:
      currentIndex === -1 ? published.length : Math.max(0, currentIndex),
    isComplete,
  };
}
