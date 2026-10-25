export type SearchParams = Record<string, string | string[] | undefined>;

export const ADMIN_PAGE_SIZE = 20;

export function one(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  const t = s?.trim();
  return t ? t.slice(0, 80) : undefined;
}

/** Returns the value only if it is one of `allowed` (guards enum filters against junk input). */
export function oneOf<T extends string>(sp: SearchParams, key: string, allowed: readonly T[]): T | undefined {
  const v = one(sp, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function pageOf(sp: SearchParams) {
  const n = Number(one(sp, "page"));
  return Number.isInteger(n) && n > 0 ? n : 1;
}
