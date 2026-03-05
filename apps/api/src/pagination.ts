const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function parsePageSize(raw: string | undefined, defaultSize = DEFAULT_PAGE_SIZE): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return defaultSize;
  return Math.min(n, MAX_PAGE_SIZE);
}
