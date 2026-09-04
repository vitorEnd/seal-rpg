import { usesSgioRules } from "@/domain/campaign-rules";

export const CHARACTER_ATTRIBUTE_KEYS = [
  "physical",
  "agility",
  "marksmanship",
  "perception",
  "technique",
  "control",
  "resilience",
  "intellect",
  "presence",
  "energy",
  "adaptation",
] as const;

export type CharacterAttributeKey = (typeof CHARACTER_ATTRIBUTE_KEYS)[number];

export type CharacterAttributes = Record<CharacterAttributeKey, number>;

export interface CharacterAttributeDefinition {
  key: CharacterAttributeKey;
  label: string;
  description: string;
}

export const CHARACTER_ATTRIBUTE_BUDGET = 8;
export const SGIO_CHARACTER_ATTRIBUTE_BUDGET = 6;
export const CHARACTER_ATTRIBUTE_MAX = 5;
export const CHARACTER_CLASS_BONUS_MAX = 5;

export const CHARACTER_ATTRIBUTE_DEFINITIONS: readonly CharacterAttributeDefinition[] = [
  {
    key: "physical",
    label: "Físico",
    description:
      "Força, resistência, carregar peso, arrombar, nadar, correr e suportar ferimentos ou esforço.",
  },
  {
    key: "agility",
    label: "Agilidade",
    description:
      "Movimentação, furtividade, reflexos, escalada, equilíbrio e ações rápidas.",
  },
  {
    key: "marksmanship",
    label: "Pontaria",
    description:
      "Precisão com armas, tiros difíceis, controle de disparo e reação em combate.",
  },
  {
    key: "perception",
    label: "Percepção",
    description:
      "Encontrar inimigos, notar armadilhas, ouvir movimentações, identificar detalhes e vigiar áreas.",
  },
  {
    key: "technique",
    label: "Técnica",
    description:
      "Computadores, rádios, explosivos, veículos, equipamentos, eletrônica e sistemas.",
  },
  {
    key: "control",
    label: "Controle",
    description:
      "Manter a calma sob pressão, resistir a medo ou pânico, decidir rápido e agir bem no caos.",
  },
];

export const SGIO_CHARACTER_ATTRIBUTE_DEFINITIONS: readonly CharacterAttributeDefinition[] = [
  {
    key: "physical",
    label: "Potência",
    description:
      "Força, impacto, capacidade de ruptura e manifestações físicas sobre-humanas.",
  },
  {
    key: "agility",
    label: "Mobilidade",
    description:
      "Reflexos, velocidade, furtividade, acrobacia e deslocamentos especiais.",
  },
  {
    key: "marksmanship",
    label: "Combate",
    description:
      "Luta corporal, armas, precisão e aplicação ofensiva de poderes.",
  },
  {
    key: "perception",
    label: "Investigação",
    description:
      "Sentidos, rastreamento, análise de cenas e identificação de anomalias.",
  },
  {
    key: "technique",
    label: "Tecnologia",
    description:
      "Ciência, engenharia, hacking, equipamentos avançados e biomecânica.",
  },
  {
    key: "control",
    label: "Domínio",
    description:
      "Controle fino de poderes, foco, estabilidade emocional e resistência mental.",
  },
  {
    key: "resilience",
    label: "Resistência",
    description:
      "Suportar trauma, venenos, exaustão, dor extrema e efeitos anormais prolongados.",
  },
  {
    key: "intellect",
    label: "Intelecto",
    description:
      "Raciocínio, estratégia, memória, dedução e compreensão de fenômenos complexos.",
  },
  {
    key: "presence",
    label: "Presença",
    description:
      "Influência, liderança, intimidação, leitura social e força de personalidade.",
  },
  {
    key: "energy",
    label: "Energia",
    description:
      "Reserva para ativar poderes, sustentar capacidades especiais e recuperar intensidade.",
  },
  {
    key: "adaptation",
    label: "Adaptação",
    description:
      "Improviso, evolução sob pressão e resposta a ambientes ou ameaças desconhecidas.",
  },
];

export function getCharacterAttributeDefinitions(
  campaignSlug: string,
): readonly CharacterAttributeDefinition[] {
  return usesSgioRules(campaignSlug)
    ? SGIO_CHARACTER_ATTRIBUTE_DEFINITIONS
    : CHARACTER_ATTRIBUTE_DEFINITIONS;
}

export function getCharacterAttributeBudget(campaignSlug: string): number {
  return usesSgioRules(campaignSlug)
    ? SGIO_CHARACTER_ATTRIBUTE_BUDGET
    : CHARACTER_ATTRIBUTE_BUDGET;
}

export const EMPTY_CHARACTER_ATTRIBUTES: CharacterAttributes = {
  physical: 0,
  agility: 0,
  marksmanship: 0,
  perception: 0,
  technique: 0,
  control: 0,
  resilience: 0,
  intellect: 0,
  presence: 0,
  energy: 0,
  adaptation: 0,
};

export const LEGACY_CHARACTER_ATTRIBUTES: CharacterAttributes = {
  physical: 2,
  agility: 2,
  marksmanship: 1,
  perception: 1,
  technique: 1,
  control: 1,
  resilience: 0,
  intellect: 0,
  presence: 0,
  energy: 0,
  adaptation: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValidValues(
  value: unknown,
  maximum: number,
): value is CharacterAttributes {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (
    keys.length !== CHARACTER_ATTRIBUTE_KEYS.length ||
    keys.some(
      (key) =>
        !CHARACTER_ATTRIBUTE_KEYS.includes(key as CharacterAttributeKey),
    )
  ) {
    return false;
  }
  return CHARACTER_ATTRIBUTE_KEYS.every((key) => {
    const attribute = value[key];
    return (
      typeof attribute === "number" &&
      Number.isInteger(attribute) &&
      attribute >= 0 &&
      attribute <= maximum
    );
  });
}

export function characterAttributeTotal(
  attributes: CharacterAttributes,
  keys: readonly CharacterAttributeKey[] = CHARACTER_ATTRIBUTE_KEYS,
): number {
  return keys.reduce((total, key) => total + attributes[key], 0);
}

export function isValidCharacterAttributes(
  value: unknown,
  budget: number = CHARACTER_ATTRIBUTE_BUDGET,
): value is CharacterAttributes {
  return (
    hasValidValues(value, CHARACTER_ATTRIBUTE_MAX) &&
    characterAttributeTotal(value) === budget
  );
}

export function isValidCharacterAttributesForCampaign(
  value: unknown,
  campaignSlug: string,
): value is CharacterAttributes {
  if (!hasValidValues(value, CHARACTER_ATTRIBUTE_MAX)) return false;
  const activeKeys = getCharacterAttributeDefinitions(campaignSlug).map(
    ({ key }) => key,
  );
  const activeKeySet = new Set(activeKeys);
  return (
    CHARACTER_ATTRIBUTE_KEYS.every(
      (key) => activeKeySet.has(key) || value[key] === 0,
    ) &&
    characterAttributeTotal(value, activeKeys) ===
      getCharacterAttributeBudget(campaignSlug)
  );
}

export function isValidCharacterAttributesForKnownCampaign(
  value: unknown,
): value is CharacterAttributes {
  return (
    isValidCharacterAttributes(value, CHARACTER_ATTRIBUTE_BUDGET) ||
    isValidCharacterAttributes(value, SGIO_CHARACTER_ATTRIBUTE_BUDGET)
  );
}

export function isValidCharacterAttributeBonuses(
  value: unknown,
): value is CharacterAttributes {
  return hasValidValues(value, CHARACTER_CLASS_BONUS_MAX);
}

function copyAttributes(attributes: CharacterAttributes): CharacterAttributes {
  return Object.fromEntries(
    CHARACTER_ATTRIBUTE_KEYS.map((key) => [key, attributes[key]]),
  ) as CharacterAttributes;
}

export function normalizeCharacterAttributes(value: unknown): CharacterAttributes {
  if (isRecord(value)) {
    const normalized = Object.fromEntries(
      CHARACTER_ATTRIBUTE_KEYS.map((key) => [key, value[key] ?? 0]),
    );
    if (isValidCharacterAttributesForKnownCampaign(normalized)) {
      return copyAttributes(normalized);
    }
  }
  return copyAttributes(LEGACY_CHARACTER_ATTRIBUTES);
}

export function normalizeCharacterAttributeBonuses(
  value: unknown,
): CharacterAttributes {
  if (!isRecord(value)) return copyAttributes(EMPTY_CHARACTER_ATTRIBUTES);
  return Object.fromEntries(
    CHARACTER_ATTRIBUTE_KEYS.map((key) => {
      const bonus = value[key];
      return [
        key,
        typeof bonus === "number" &&
        Number.isInteger(bonus) &&
        bonus >= 0 &&
        bonus <= CHARACTER_CLASS_BONUS_MAX
          ? bonus
          : 0,
      ];
    }),
  ) as CharacterAttributes;
}

export function calculateEffectiveAttributes(
  base: CharacterAttributes,
  bonuses: CharacterAttributes,
): CharacterAttributes {
  return Object.fromEntries(
    CHARACTER_ATTRIBUTE_KEYS.map((key) => [key, base[key] + bonuses[key]]),
  ) as CharacterAttributes;
}
