export const ALLOWED_DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;

export type AllowedDiceSides = (typeof ALLOWED_DICE_SIDES)[number];

export interface ParsedDiceExpression {
  count: number;
  sides: AllowedDiceSides;
  modifier: number;
  expression: string;
}

export interface DiceResult extends ParsedDiceExpression {
  diceValues: number[];
  total: number;
}

const DICE_EXPRESSION = /^(\d{0,2})d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/i;
const DICE_SIDES = new Set<number>(ALLOWED_DICE_SIDES);

export function parseDiceExpression(value: string): ParsedDiceExpression | null {
  const normalized = value.trim().replace(/\s+/g, "").toLocaleLowerCase("pt-BR");
  const match = DICE_EXPRESSION.exec(normalized);

  if (!match) {
    return null;
  }

  const count = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]);
  const modifier = match[3] ? Number(match[3]) : 0;

  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 20 ||
    !DICE_SIDES.has(sides) ||
    !Number.isInteger(modifier) ||
    Math.abs(modifier) > 100
  ) {
    return null;
  }

  const modifierText = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : "";

  return {
    count,
    sides: sides as AllowedDiceSides,
    modifier,
    expression: `${count}d${sides}${modifierText}`,
  };
}

export function rollParsedDice(
  parsed: ParsedDiceExpression,
  rollDie: (sides: AllowedDiceSides) => number,
): DiceResult {
  const diceValues = Array.from({ length: parsed.count }, () => {
    const result = rollDie(parsed.sides);
    if (!Number.isInteger(result) || result < 1 || result > parsed.sides) {
      throw new Error("DICE_ROLL_OUT_OF_RANGE");
    }
    return result;
  });

  return {
    ...parsed,
    diceValues,
    total: diceValues.reduce((total, result) => total + result, parsed.modifier),
  };
}
