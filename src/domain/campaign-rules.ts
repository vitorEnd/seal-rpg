export const SGIO_CAMPAIGN_SLUG = "sgio-soldados-fantasmas";

export function usesSgioRules(campaignSlug: string): boolean {
  return campaignSlug === SGIO_CAMPAIGN_SLUG;
}

export interface CharacterOptionTerminology {
  singular: "Classe" | "Tipo";
  plural: "Classes" | "Tipos";
  article: "uma classe" | "um tipo";
  unavailable: "Classe indisponível" | "Tipo indisponível";
  supportsAttributeBonuses: boolean;
}

export function getCharacterOptionTerminology(
  campaignSlug: string,
): CharacterOptionTerminology {
  return usesSgioRules(campaignSlug)
    ? {
        singular: "Tipo",
        plural: "Tipos",
        article: "um tipo",
        unavailable: "Tipo indisponível",
        supportsAttributeBonuses: false,
      }
    : {
        singular: "Classe",
        plural: "Classes",
        article: "uma classe",
        unavailable: "Classe indisponível",
        supportsAttributeBonuses: true,
      };
}
