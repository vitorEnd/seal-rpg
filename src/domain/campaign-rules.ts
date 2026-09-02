export const SGIO_CAMPAIGN_SLUG = "sgio-soldados-fantasmas";

export function usesSgioRules(campaignSlug: string): boolean {
  return campaignSlug === SGIO_CAMPAIGN_SLUG;
}
