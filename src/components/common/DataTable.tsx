import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns3,
  Check,
  SlidersHorizontal,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Select, SelectOption } from './Select.tsx';
import { useAppStore } from '../../store/useAppStore.ts';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
  mobileRender?: (row: T) => React.ReactNode;
  defaultVisible?: boolean;
  hideOnMobileDefault?: boolean;
  alwaysVisible?: boolean;
  className?: string;
}

export interface DataTableFilter {
  key: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
}

interface DataTableProps<T> {
  tableId: string;
  data: T[];
  columns: DataTableColumn<T>[];
  keyExtractor: (row: T) => string | number;
  loading?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  filters?: DataTableFilter[];
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  onRowClick?: (row: T) => void;
  mobileCardTitle?: (row: T) => React.ReactNode;
  mobileCardSubtitle?: (row: T) => React.ReactNode;
  mobileCardBadge?: (row: T) => React.ReactNode;
  mobileCardActions?: (row: T) => React.ReactNode;
  headerActions?: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function DataTable<T>({
  tableId,
  data,
  columns,
  keyExtractor,
  loading = false,
  emptyMessage = 'No records found.',
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  filters = [],
  defaultSortKey,
  defaultSortDir = 'desc',
  onRowClick,
  mobileCardTitle,
  mobileCardSubtitle,
  mobileCardBadge,
  mobileCardActions,
  headerActions,
  title,
  subtitle,
}: DataTableProps<T>) {
  const { columnPrefs, setColumnPrefs } = useAppStore();
  const [internalSearch, setInternalSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const query = searchValue !== undefined ? searchValue : internalSearch;
  const setQuery = onSearchChange || setInternalSearch;

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Determine visible columns (respecting stored preference or defaultVisible)
  const visibleColumnKeys = useMemo(() => {
    const saved = columnPrefs[tableId];
    if (saved && saved.length > 0) {
      // Ensure alwaysVisible columns stay included
      const alwaysKeys = columns.filter((c) => c.alwaysVisible).map((c) => c.key);
      return Array.from(new Set([...saved, ...alwaysKeys]));
    }
    return columns.filter((c) => c.defaultVisible !== false).map((c) => c.key);
  }, [columnPrefs, tableId, columns]);

  const toggleColumn = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (col?.alwaysVisible) return;
    const isCurrentlyVisible = visibleColumnKeys.includes(key);
    let next: string[];
    if (isCurrentlyVisible) {
      if (visibleColumnKeys.length <= 2) return; // keep at least 2 columns
      next = visibleColumnKeys.filter((k) => k !== key);
    } else {
      next = [...visibleColumnKeys, key];
    }
    setColumnPrefs(tableId, next);
  };

  const resetColumns = () => {
    setColumnPrefs(
      tableId,
      columns.filter((c) => c.defaultVisible !== false).map((c) => c.key)
    );
  };

  const visibleColumns = useMemo(
    () => columns.filter((c) => visibleColumnKeys.includes(c.key)),
    [columns, visibleColumnKeys]
  );

  // Local search fallback if consumer didn't supply onSearchChange
  const searchedData = useMemo(() => {
    if (onSearchChange || !query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      Object.values(row as Record<string, unknown>).some((val) =>
        String(val ?? '').toLowerCase().includes(q)
      )
    );
  }, [data, query, onSearchChange]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return searchedData;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return searchedData;

    return [...searchedData].sort((a, b) => {
      const valA = col.sortValue ? col.sortValue(a) : (a as Record<string, any>)[col.key];
      const valB = col.sortValue ? col.sortValue(b) : (b as Record<string, any>)[col.key];

      const numA = typeof valA === 'number' ? valA : Number(valA);
      const numB = typeof valB === 'number' ? valB : Number(valB);

      if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
        return sortDir === 'asc' ? numA - numB : numB - numA;
      }

      const strA = String(valA ?? '').toLowerCase();
      const strB = String(valB ?? '').toLowerCase();
      if (strA < strB) return sortDir === 'asc' ? -1 : 1;
      if (strA > strB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [searchedData, sortKey, sortDir, columns]);

  const handleSort = (col: DataTableColumn<T>) => {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  };

  return (
    <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.05)]">
      {/* Toolbar Header */}
      <div className="p-4 sm:p-5 border-b border-[#E3E6E8] dark:border-[#2A2F35] space-y-3">
        {(title || headerActions) && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {title && (
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#14161A] dark:text-[#F2F4F5]">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-xs text-[#636B76] dark:text-[#8A929C] mt-0.5">{subtitle}</p>
                )}
              </div>
            )}
            {headerActions}
          </div>
        )}

        {/* Search + Contextual Filters + Column Picker */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 min-w-0">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#636B76] dark:text-[#8A929C]" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full min-h-[40px] pl-9 pr-3.5 py-1.5 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328]/80 text-[#14161A] dark:text-[#F2F4F5] placeholder:text-[#636B76] dark:placeholder:text-[#8A929C] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
              />
            </div>

            {/* Inline Filters right beside Search */}
            {filters.length > 0 && (
              <div className="grid grid-cols-2 sm:flex sm:flex-nowrap sm:items-center gap-2 shrink-0">
                {filters.map((f) => (
                  <div
                    key={f.key}
                    className={`${filters.length === 1 ? 'col-span-2 sm:col-span-1' : ''} sm:min-w-[155px]`}
                  >
                    <Select
                      size="sm"
                      value={f.value}
                      onChange={f.onChange}
                      options={f.options}
                      placeholder={f.label}
                      ariaLabel={f.label}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right side: Column Filter */}
          <div className="flex items-center justify-end shrink-0">
            <div className="relative" ref={pickerRef}>
              <button
                type="button"
                onClick={() => setColPickerOpen((o) => !o)}
                className="min-h-[38px] px-3 py-1.5 rounded-[12px] border border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F3F5F6]/70 dark:bg-[#1F2328]/80 hover:bg-[#EDEEEF] dark:hover:bg-[#272C33] text-xs font-semibold text-[#14161A] dark:text-[#F2F4F5] flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span>Columns</span>
                <span className="px-1.5 py-0.5 rounded-full bg-[#D4F56B] text-[#14161A] text-[10px] font-bold leading-none">
                  {visibleColumns.length}/{columns.length}
                </span>
              </button>

              <AnimatePresence>
                {colPickerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.14 }}
                    className="absolute right-0 mt-1.5 w-60 max-w-[calc(100vw-2rem)] p-2 rounded-[16px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-2xl z-50"
                  >
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#E3E6E8] dark:border-[#2A2F35] mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#636B76] dark:text-[#8A929C] flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3 h-3" />
                        Show Columns
                      </span>
                      <button
                        type="button"
                        onClick={resetColumns}
                        className="text-[11px] font-semibold text-[#14161A] dark:text-[#D4F56B] hover:underline focus:outline-none cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-0.5">
                      {columns.map((col) => {
                        const checked = visibleColumnKeys.includes(col.key);
                        return (
                          <button
                            key={col.key}
                            type="button"
                            disabled={col.alwaysVisible}
                            onClick={() => toggleColumn(col.key)}
                            className={`w-full px-2.5 py-2 rounded-[10px] text-xs flex items-center justify-between transition focus:outline-none focus-visible:outline-none cursor-pointer ${
                              col.alwaysVisible
                                ? 'opacity-60 cursor-not-allowed'
                                : 'hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328]'
                            }`}
                          >
                            <span className="text-[#14161A] dark:text-[#F2F4F5] font-medium truncate">
                              {col.header}
                            </span>
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center border ${
                                checked
                                  ? 'bg-[#D4F56B] border-[#14161A]/20 text-[#14161A]'
                                  : 'border-[#D7DBDF] dark:border-[#373E47]'
                              }`}
                            >
                              {checked && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP / TABLET TABLE VIEW (md+) */}
      <div className="hidden md:block overflow-x-auto rounded-b-[20px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#F8F9FA] dark:bg-[#20242A] border-b border-[#E3E6E8] dark:border-[#2A2F35] text-[#7B848F] dark:text-[#8A929C] font-medium uppercase tracking-wider text-[11px]">
              {visibleColumns.map((col) => {
                const isSorted = sortKey === col.key;
                const alignClass =
                  col.align === 'right'
                    ? 'text-right justify-end'
                    : col.align === 'center'
                    ? 'text-center justify-center'
                    : 'text-left justify-start';

                return (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col)}
                    className={`py-3 px-3.5 font-medium whitespace-nowrap select-none ${
                      col.sortable
                        ? 'cursor-pointer hover:text-[#4A515B] dark:hover:text-[#F2F4F5] transition-colors'
                        : ''
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 ${alignClass}`}>
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="inline-flex">
                          {isSorted ? (
                            sortDir === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-[#14161A] dark:text-[#D4F56B]" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-[#14161A] dark:text-[#D4F56B]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E6E8] dark:divide-[#2A2F35] font-normal text-[#636B76] dark:text-[#A3AAB3] tabular-nums">
            {loading && sortedData.length === 0 ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <tr key={`skeleton-row-${idx}`} className="animate-pulse">
                  {visibleColumns.map((col) => (
                    <td key={col.key} className="py-3.5 px-3.5">
                      <div className="h-3.5 w-3/4 rounded-md bg-[#EDEEEF] dark:bg-[#272C33]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="py-10 text-center text-[#636B76] dark:text-[#8A929C]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`hover:bg-[#F3F5F6]/70 dark:hover:bg-[#20242A]/70 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {visibleColumns.map((col) => {
                    const alignClass =
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left';
                    return (
                      <td
                        key={col.key}
                        className={`py-3 px-3.5 ${alignClass} ${col.className || ''}`}
                      >
                        {col.render(row)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE CLEAN LIST CARDS VIEW (< md) */}
      <div className="md:hidden rounded-b-[20px]">
        {/* Mobile Compact Sort Bar */}
        {columns.some((c) => c.sortable) && sortedData.length > 0 && (
          <div className="px-4 py-2.5 bg-[#F8F9FA] dark:bg-[#20242A] border-b border-[#E3E6E8] dark:border-[#2A2F35] flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#636B76] dark:text-[#8A929C] shrink-0">
              Sort:
            </span>
            <div className="flex-1 min-w-0">
              <Select
                size="sm"
                value={sortKey || ''}
                onChange={(nextKey) => {
                  setSortKey(nextKey);
                  setSortDir('desc');
                }}
                options={columns
                  .filter((c) => c.sortable)
                  .map((c) => ({ value: c.key, label: c.header }))}
                placeholder="Default order"
                ariaLabel="Sort rows by"
              />
            </div>
            {sortKey && (
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                aria-label={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
                className="min-h-[38px] px-3 rounded-[12px] border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-xs font-semibold text-[#14161A] dark:text-[#F2F4F5] flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {sortDir === 'asc' ? (
                  <>
                    <ArrowUp className="w-3.5 h-3.5" />
                    <span>Low</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>High</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        <div className="divide-y divide-[#E3E6E8] dark:divide-[#2A2F35]">
          {loading && sortedData.length === 0 ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={`mobile-skel-${idx}`} className="p-4 space-y-2.5 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-32 rounded-md bg-[#EDEEEF] dark:bg-[#272C33]" />
                  <div className="h-4 w-16 rounded-full bg-[#EDEEEF] dark:bg-[#272C33]" />
                </div>
                <div className="h-12 w-full rounded-[12px] bg-[#F8F9FA] dark:bg-[#20242A]" />
              </div>
            ))
          ) : sortedData.length === 0 ? (
            <div className="py-10 px-4 text-center text-xs text-[#636B76] dark:text-[#8A929C]">
              {emptyMessage}
            </div>
          ) : (
            sortedData.map((row) => {
              const detailColumns = visibleColumns.filter(
                (c) => !c.hideOnMobileDefault && c.key !== 'actions'
              );
              const actionCol = visibleColumns.find((c) => c.key === 'actions');

              return (
                <div
                  key={keyExtractor(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`p-4 space-y-2.5 ${
                    onRowClick ? 'active:bg-[#F3F5F6] dark:active:bg-[#20242A]' : ''
                  }`}
                >
                  {(mobileCardTitle || mobileCardBadge) && (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {mobileCardTitle && (
                          <div className="font-bold text-[13px] text-[#14161A] dark:text-[#F2F4F5] truncate">
                            {mobileCardTitle(row)}
                          </div>
                        )}
                        {mobileCardSubtitle && (
                          <div className="text-[11px] text-[#636B76] dark:text-[#8A929C] mt-0.5 truncate">
                            {mobileCardSubtitle(row)}
                          </div>
                        )}
                      </div>
                      {mobileCardBadge && <div className="shrink-0">{mobileCardBadge(row)}</div>}
                    </div>
                  )}

                  {detailColumns.length > 0 && (
                    <div className="rounded-[12px] bg-[#F8F9FA] dark:bg-[#20242A] px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      {detailColumns.map((col) => (
                        <div key={col.key} className="min-w-0 flex flex-col gap-0.5">
                          <span className="text-[11px] font-medium text-[#636B76] dark:text-[#8A929C] truncate">
                            {col.header}
                          </span>
                          <span className="text-[#14161A] dark:text-[#F2F4F5] font-semibold truncate">
                            {col.mobileRender ? col.mobileRender(row) : col.render(row)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(mobileCardActions || actionCol) && (
                    <div className="pt-1 flex items-center justify-end gap-2">
                      {mobileCardActions ? mobileCardActions(row) : actionCol?.render(row)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
