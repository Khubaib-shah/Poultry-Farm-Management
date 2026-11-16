import React, { useId } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { APPLE_BUBBLE_SPRING } from '../../utils/appleBubbleMotion.ts';
import { AppleBubbleButton } from './AppleBubbleButton.tsx';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  computePaginationMeta,
} from '../../utils/paginationCache.ts';

interface PaginationProps {
  total: number;
  limit: number;
  skip: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  isFetching?: boolean;
  isStale?: boolean;
  pageSizeOptions?: readonly number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  total,
  limit = DEFAULT_PAGE_SIZE,
  skip = 0,
  onPageChange,
  onPageSizeChange,
  isFetching = false,
  isStale = false,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}) => {
  const pillId = useId();

  if (total <= 0 && !isFetching) {
    return null;
  }

  const meta = computePaginationMeta({ total, limit, skip });

  return (
    <div
      data-testid="table-pagination"
      className="px-4 sm:px-5 py-3 border-t border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F8F9FA]/70 dark:bg-[#1B1F24] rounded-b-[20px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
    >
      {/* Left: Per-Page View Selector + Range Summary */}
      <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3">
        <label className="inline-flex items-center gap-2 text-[#636B76] dark:text-[#8A929C] font-medium">
          <span className="whitespace-nowrap">Per page:</span>
          <div className="relative inline-flex items-center">
            <select
              aria-label="Rows per page"
              value={limit}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="appearance-none min-h-[34px] pl-3 pr-7 py-1 rounded-[10px] border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] text-xs font-bold font-mono tabular-nums cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#636B76] dark:text-[#8A929C] pointer-events-none absolute right-2" />
          </div>
        </label>

        <div className="flex items-center gap-2 text-[#4A515B] dark:text-[#A3AAB3] font-mono tabular-nums">
          <span>
            Showing{' '}
            <strong className="text-[#14161A] dark:text-[#F2F4F5] font-bold">
              {meta.startRow}–{meta.endRow}
            </strong>{' '}
            of{' '}
            <strong className="text-[#14161A] dark:text-[#F2F4F5] font-bold">{total}</strong>
          </span>

          {(isFetching || isStale) && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] text-[10px] font-sans font-semibold text-[#4A515B] dark:text-[#A3AAB3]"
              aria-live="polite"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Updating</span>
            </span>
          )}
        </div>
      </div>

      {/* Right: Prev / Page Numbers / Next */}
      <div className="flex items-center justify-between sm:justify-end gap-1.5">
        <AppleBubbleButton
          type="button"
          onClick={() => onPageChange(meta.currentPage - 1)}
          disabled={!meta.canPrev}
          aria-label="Previous page"
          hoverScale={1.03}
          tapScale={0.9}
          className="min-h-[34px] px-2.5 sm:px-3 py-1 rounded-[10px] border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] font-semibold inline-flex items-center gap-1 hover:bg-[#EDEEEF] dark:hover:bg-[#272C33] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronLeft className="relative z-10 w-3.5 h-3.5" />
          <span className="relative z-10">Prev</span>
        </AppleBubbleButton>

        {/* Desktop / Tablet numbered page pills */}
        <div className="hidden sm:flex items-center gap-1">
          {meta.pageNumbers.map((entry, idx) =>
            entry === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1.5 text-[#636B76] dark:text-[#8A929C] font-mono select-none"
              >
                …
              </span>
            ) : (
              <AppleBubbleButton
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                aria-label={`Page ${entry}`}
                aria-current={entry === meta.currentPage ? 'page' : undefined}
                hoverScale={1.06}
                tapScale={0.86}
                className={`min-w-[34px] min-h-[34px] px-2 rounded-full font-mono font-bold tabular-nums transition-colors cursor-pointer inline-flex items-center justify-center ${
                  entry === meta.currentPage
                    ? 'text-[#14161A]'
                    : 'text-[#4A515B] dark:text-[#A3AAB3] hover:bg-[#EDEEEF] dark:hover:bg-[#272C33]'
                }`}
              >
                {entry === meta.currentPage && (
                  <motion.span
                    layoutId={`paginationActivePill-${pillId}`}
                    transition={APPLE_BUBBLE_SPRING}
                    className="absolute inset-0 rounded-full bg-[#D4F56B] z-0"
                  />
                )}
                <span className="relative z-10">{entry}</span>
              </AppleBubbleButton>
            )
          )}
        </div>

        {/* Mobile compact page indicator */}
        <span className="sm:hidden px-2.5 py-1 text-[11px] font-mono font-bold tabular-nums text-[#14161A] dark:text-[#F2F4F5]">
          Page {meta.currentPage} / {meta.totalPages}
        </span>

        <AppleBubbleButton
          type="button"
          onClick={() => onPageChange(meta.currentPage + 1)}
          disabled={!meta.canNext}
          aria-label="Next page"
          hoverScale={1.03}
          tapScale={0.9}
          className="min-h-[34px] px-2.5 sm:px-3 py-1 rounded-[10px] border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] font-semibold inline-flex items-center gap-1 hover:bg-[#EDEEEF] dark:hover:bg-[#272C33] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <span className="relative z-10">Next</span>
          <ChevronRight className="relative z-10 w-3.5 h-3.5" />
        </AppleBubbleButton>
      </div>
    </div>
  );
};
