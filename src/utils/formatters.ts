/**
 * Formatting utilities for Pakistani Poultry Business
 */

export function formatPKR(val: number | string | null | undefined): string {
  if (val === null || val === undefined || isNaN(Number(val))) return 'PKR 0';
  const num = Number(val);
  const absFormatted = Math.abs(num).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return num < 0 ? `-PKR ${absFormatted}` : `PKR ${absFormatted}`;
}

export function formatSignedPKR(val: number | string | null | undefined): string {
  const num = Number(val ?? 0);
  if (isNaN(num) || num === 0) return 'PKR 0';
  const absFormatted = Math.abs(num).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return num > 0 ? `+PKR ${absFormatted}` : `-PKR ${absFormatted}`;
}

export function formatNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || isNaN(Number(val))) return '0';
  return Number(val).toLocaleString('en-PK');
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}
