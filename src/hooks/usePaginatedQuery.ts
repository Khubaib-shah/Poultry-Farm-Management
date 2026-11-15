import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../services/api.ts';
import { useAppStore } from '../store/useAppStore.ts';
import {
  DEFAULT_PAGE_SIZE,
  PaginatedResponse,
  buildPaginationKey,
  buildPaginationQueryString,
  pageResponseCache,
} from '../utils/paginationCache.ts';

export interface UsePaginatedQueryOptions {
  endpoint?: string;
  params?: Record<string, string | number | boolean | null | undefined>;
  search?: string;
  sortKey?: string | null;
  sortDir?: 'asc' | 'desc';
  defaultPageSize?: number;
}

export interface UsePaginatedQueryResult<T> {
  enabled: boolean;
  items: T[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
  isInitialLoading: boolean;
  isFetching: boolean;
  isStaleData: boolean;
  fromCache: boolean;
  error: string | null;
  setPageIndex: (page: number) => void;
  setPageSize: (size: number) => void;
  refetch: () => void;
}

export function usePaginatedQuery<T>({
  endpoint,
  params = {},
  search = '',
  sortKey = null,
  sortDir = 'desc',
  defaultPageSize = DEFAULT_PAGE_SIZE,
}: UsePaginatedQueryOptions): UsePaginatedQueryResult<T> {
  const enabled = Boolean(endpoint);
  const workspace = useAppStore((s) => s.workspace);
  const dataCacheVersion = useAppStore((s) => s.dataCacheVersion);

  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setDebouncedSearch('');
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedSearch(trimmed);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filterParams = useMemo(() => {
    return {
      ...params,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(sortKey ? { sortKey, sortDir } : {}),
    };
  }, [params, debouncedSearch, sortKey, sortDir]);

  const filterSignature = useMemo(
    () => buildPaginationQueryString(filterParams),
    [filterParams]
  );

  const [paging, setPaging] = useState<{
    limit: number;
    skip: number;
    filterSignature: string;
  }>(() => ({
    limit: defaultPageSize,
    skip: 0,
    filterSignature,
  }));

  useEffect(() => {
    setPaging((prev) =>
      prev.filterSignature === filterSignature
        ? prev
        : { limit: prev.limit, skip: 0, filterSignature }
    );
  }, [filterSignature]);

  const activeLimit = paging.limit;
  const activeSkip = paging.filterSignature === filterSignature ? paging.skip : 0;

  const queryParams = useMemo(
    () => ({
      ...filterParams,
      limit: activeLimit,
      skip: activeSkip,
    }),
    [filterParams, activeLimit, activeSkip]
  );
  const queryParamsRef = useRef(queryParams);
  queryParamsRef.current = queryParams;

  const cacheKey = useMemo(() => {
    if (!endpoint) return '';
    return buildPaginationKey({
      endpoint,
      params: queryParams,
      workspace,
      cacheEpoch: dataCacheVersion,
    });
  }, [endpoint, queryParams, workspace, dataCacheVersion]);

  const staleRef = useRef<{
    workspace: string;
    endpoint: string;
    data: PaginatedResponse<T> | null;
  }>({
    workspace,
    endpoint: endpoint || '',
    data: null,
  });

  if (
    staleRef.current.workspace !== workspace ||
    staleRef.current.endpoint !== (endpoint || '')
  ) {
    staleRef.current = {
      workspace,
      endpoint: endpoint || '',
      data: null,
    };
  }

  const [resolvedState, setResolvedState] = useState<{
    key: string;
    data: PaginatedResponse<T> | null;
    fetchingKey: string | null;
    fromCache: boolean;
    error: string | null;
  }>({
    key: '',
    data: null,
    fetchingKey: null,
    fromCache: false,
    error: null,
  });

  const [manualTick, setManualTick] = useState(0);

  const cachedSync = enabled && cacheKey ? pageResponseCache.get<T>(cacheKey) : null;
  if (cachedSync) {
    staleRef.current.data = cachedSync;
  }

  useEffect(() => {
    if (!enabled || !endpoint || !cacheKey) return;

    const hit = pageResponseCache.get<T>(cacheKey);
    if (hit) {
      staleRef.current.data = hit;
      setResolvedState((prev) =>
        prev.key === cacheKey && prev.data === hit && prev.fetchingKey === null
          ? prev
          : {
              key: cacheKey,
              data: hit,
              fetchingKey: null,
              fromCache: true,
              error: null,
            }
      );
      return;
    }

    let cancelled = false;
    setResolvedState((prev) => ({
      ...prev,
      fetchingKey: cacheKey,
      error: null,
    }));

    const paramsForFetch = queryParamsRef.current;

    pageResponseCache
      .getOrFetch<T>(cacheKey, () => api.getPaginated<T>(endpoint, paramsForFetch))
      .then((res) => {
        if (cancelled) return;
        staleRef.current.data = res.data;
        setResolvedState({
          key: cacheKey,
          data: res.data,
          fetchingKey: null,
          fromCache: res.fromCache,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load table page';
        setResolvedState((prev) => ({
          ...prev,
          fetchingKey: null,
          error: msg,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, endpoint, cacheKey, manualTick]);

  const setPageIndex = useCallback(
    (page: number) => {
      const safePage = Math.max(1, Math.floor(page));
      setPaging((prev) => ({
        limit: prev.limit,
        skip: (safePage - 1) * prev.limit,
        filterSignature,
      }));
    },
    [filterSignature]
  );

  const setPageSize = useCallback(
    (size: number) => {
      const safeSize = Math.max(1, Math.floor(size));
      setPaging({
        limit: safeSize,
        skip: 0,
        filterSignature,
      });
    },
    [filterSignature]
  );

  const refetch = useCallback(() => {
    if (cacheKey) {
      pageResponseCache.invalidatePrefix(endpoint || '');
    }
    setManualTick((t) => t + 1);
  }, [cacheKey, endpoint]);

  if (!enabled) {
    return {
      enabled: false,
      items: [],
      total: 0,
      limit: defaultPageSize,
      skip: 0,
      hasMore: false,
      isInitialLoading: false,
      isFetching: false,
      isStaleData: false,
      fromCache: false,
      error: null,
      setPageIndex,
      setPageSize,
      refetch,
    };
  }

  const currentData =
    cachedSync ||
    (resolvedState.key === cacheKey ? resolvedState.data : null) ||
    staleRef.current.data;

  const isFetching = !cachedSync && resolvedState.fetchingKey === cacheKey;
  const isStaleData =
    !cachedSync &&
    resolvedState.key !== cacheKey &&
    Boolean(staleRef.current.data);
  const isInitialLoading = !currentData && isFetching;

  return {
    enabled: true,
    items: currentData?.items || [],
    total: currentData?.total ?? 0,
    limit: activeLimit,
    skip: activeSkip,
    hasMore: currentData?.hasMore ?? false,
    isInitialLoading,
    isFetching,
    isStaleData,
    fromCache: Boolean(cachedSync) || (resolvedState.key === cacheKey && resolvedState.fromCache),
    error: resolvedState.error,
    setPageIndex,
    setPageSize,
    refetch,
  };
}
