/**
 * FIB-4 = (age in years x AST in U/L) / (platelets in 10^9/L x square root of ALT in U/L).
 * A helper for the telemedicine clinician only: it works out the number from values the clinician types, and the clinician
 * checks it and decides. It applies no threshold and gives no interpretation, and nothing here is saved or sent.
 */
export type Fib4Input = { age: number; ast: number; alt: number; platelets: number };

const LIMITS = { age: [18, 120], ast: [1, 10000], alt: [1, 10000], platelets: [1, 2000] } as const;

/** The FIB-4 value rounded to two decimals, or null when a value is missing or outside a believable range. */
export function fib4(input: Fib4Input): number | null {
  for (const key of Object.keys(LIMITS) as (keyof Fib4Input)[]) {
    const value = input[key];
    const [min, max] = LIMITS[key];
    if (!Number.isFinite(value) || value < min || value > max) return null;
  }
  const raw = (input.age * input.ast) / (input.platelets * Math.sqrt(input.alt));
  return Math.round(raw * 100) / 100;
}
