export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  startRow: number;
  endRow: number;
  canPrev: boolean;
  canNext: boolean;
  pageNumbers: Array<number | 'ellipsis'>;
}

export function computePaginationMeta(input: {
  total: number;
  limit: number;
  skip: number;
}): PaginationMeta {
  const safeLimit = Math.max(1, Math.floor(input.limit || DEFAULT_PAGE_SIZE));
  const safeTotal = Math.max(0, Math.floor(input.total || 0));
  const safeSkip = Math.max(0, Math.floor(input.skip || 0));

  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));
  const rawPage = Math.floor(safeSkip / safeLimit) + 1;
  const currentPage = Math.min(Math.max(1, rawPage), totalPages);

  const startRow = safeTotal === 0 ? 0 : Math.min((currentPage - 1) * safeLimit + 1, safeTotal);
  const endRow = safeTotal === 0 ? 0 : Math.min(currentPage * safeLimit, safeTotal);

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages && safeTotal > 0;

  const pageNumbers: Array<number | 'ellipsis'> = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
  } else {
    pageNumbers.push(1);
    const windowStart = Math.max(2, currentPage - 1);
    const windowEnd = Math.min(totalPages - 1, currentPage + 1);

    if (windowStart > 2) {
      pageNumbers.push('ellipsis');
    }
    for (let i = windowStart; i <= windowEnd; i++) {
      pageNumbers.push(i);
    }
    if (windowEnd < totalPages - 1) {
      pageNumbers.push('ellipsis');
    }
    pageNumbers.push(totalPages);
  }

  return {
    currentPage,
    totalPages,
    startRow,
    endRow,
    canPrev,
    canNext,
    pageNumbers,
  };
}

export function buildPaginationQueryString(
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const entries = Object.entries(params)
    .filter(([, val]) => val !== undefined && val !== null && String(val).trim() !== '')
    .sort(([a], [b]) => a.localeCompare(b));

  const searchParams = new URLSearchParams();
  for (const [key, val] of entries) {
    searchParams.set(key, String(val));
  }
  return searchParams.toString();
}

export function buildPaginationKey(input: {
  endpoint: string;
  params: Record<string, string | number | boolean | null | undefined>;
  workspace?: string;
  cacheEpoch?: number;
}): string {
  const ws = input.workspace || 'default';
  const epoch = input.cacheEpoch ?? 0;
  const qs = buildPaginationQueryString(input.params);
  return `${ws}::v${epoch}::${input.endpoint}${qs ? `?${qs}` : ''}`;
}

export interface ParsedServerPagination {
  limit: number;
  skip: number;
  search: string;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  all: boolean;
}

export function parseServerPaginationParams(
  query: Record<string, unknown>,
  defaultLimit = DEFAULT_PAGE_SIZE,
  maxLimit = 200
): ParsedServerPagination {
  const allFlag = String(query.all || '').toLowerCase() === 'true';
  const rawLimit = query.limit !== undefined ? parseInt(String(query.limit), 10) : defaultLimit;
  const rawSkip =
    query.skip !== undefined
      ? parseInt(String(query.skip), 10)
      : query.offset !== undefined
      ? parseInt(String(query.offset), 10)
      : 0;

  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, rawLimit), maxLimit)
    : defaultLimit;
  const skip = Number.isFinite(rawSkip) ? Math.max(0, rawSkip) : 0;

  const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
  const sortKey = typeof query.sortKey === 'string' ? query.sortKey.trim() : '';
  const sortDir = String(query.sortDir || '').toLowerCase() === 'asc' ? 'asc' : 'desc';

  return { limit, skip, search, sortKey, sortDir, all: allFlag };
}

export function sortAndPaginateRecords<T>(input: {
  records: T[];
  limit: number;
  skip: number;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  getSortValue?: (row: T, key: string) => unknown;
}): PaginatedResponse<T> {
  const { records, limit, skip, sortKey, sortDir = 'desc', getSortValue } = input;

  let working = records;
  if (sortKey) {
    working = [...records].sort((a, b) => {
      const valA = getSortValue ? getSortValue(a, sortKey) : (a as Record<string, unknown>)[sortKey];
      const valB = getSortValue ? getSortValue(b, sortKey) : (b as Record<string, unknown>)[sortKey];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined || valA === '') return 1;
      if (valB === null || valB === undefined || valB === '') return -1;

      const numA = typeof valA === 'number' ? valA : Number(valA);
      const numB = typeof valB === 'number' ? valB : Number(valB);

      if (!Number.isNaN(numA) && !Number.isNaN(numB) && typeof valA !== 'boolean' && typeof valB !== 'boolean') {
        return sortDir === 'asc' ? numA - numB : numB - numA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortDir === 'asc' ? -1 : 1;
      if (strA > strB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const total = working.length;
  const items = working.slice(skip, skip + limit);
  const hasMore = skip + items.length < total;

  return {
    items,
    total,
    limit,
    skip,
    hasMore,
  };
}

interface CacheEntry<T> {
  data: PaginatedResponse<T>;
  cachedAt: number;
}

export class ResponsePageCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<PaginatedResponse<unknown>>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(options: { maxEntries?: number; ttlMs?: number } = {}) {
    this.maxEntries = options.maxEntries ?? 150;
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000;
  }

  get<T>(key: string, now = Date.now()): PaginatedResponse<T> | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (now - entry.cachedAt > this.ttlMs) {
      this.store.delete(key);
      return null;
    }

    // Refresh insertion order for LRU
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.data as PaginatedResponse<T>;
  }

  set<T>(key: string, data: PaginatedResponse<T>, now = Date.now()): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, { data, cachedAt: now });
  }

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<PaginatedResponse<T>>,
    now = Date.now()
  ): Promise<{ data: PaginatedResponse<T>; fromCache: boolean }> {
    const cached = this.get<T>(key, now);
    if (cached) {
      return { data: cached, fromCache: true };
    }

    const existingPromise = this.inFlight.get(key) as Promise<PaginatedResponse<T>> | undefined;
    if (existingPromise) {
      const data = await existingPromise;
      return { data, fromCache: false };
    }

    const promise = fetcher()
      .then((res) => {
        this.set(key, res, Date.now());
        return res;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise as Promise<PaginatedResponse<unknown>>);
    const data = await promise;
    return { data, fromCache: false };
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
    this.inFlight.clear();
  }

  size(): number {
    return this.store.size;
  }
}

export const pageResponseCache = new ResponsePageCache({
  maxEntries: 200,
  ttlMs: 5 * 60 * 1000,
});
