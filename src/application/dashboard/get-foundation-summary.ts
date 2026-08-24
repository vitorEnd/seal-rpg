import type { RepositoryRegistry } from "@/domain/repositories";

export type FoundationSummary = Awaited<
  ReturnType<RepositoryRegistry["dashboardSummary"]["getContentCounts"]>
>;

export async function getFoundationSummary(
  repositories: RepositoryRegistry,
): Promise<FoundationSummary> {
  return repositories.dashboardSummary.getContentCounts();
}
