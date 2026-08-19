/**
 * Display formatters.
 *
 * Money and dates are formatted in exactly one place. A margin rendered two
 * different ways on two screens is how users stop trusting a number.
 */

const DEFAULT_LOCALE = 'en-GB';

export function formatMoney(
  amount: number | string | null | undefined,
  currency = 'QAR',
  options: { compact?: boolean; decimals?: number } = {},
): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(value)) return '—';

  const formatted = new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
    notation: options.compact ? 'compact' : 'standard',
    maximumFractionDigits: options.decimals ?? (options.compact ? 1 : 0),
    minimumFractionDigits: 0,
  }).format(value);

  // en-GB renders compact units lowercase ("1.5m"), which reads ambiguously on a
  // revenue tile. Uppercase them so QAR 1.5M is unmistakably millions.
  return options.compact ? formatted.replace(/([kmbt])\b/g, (unit) => unit.toUpperCase()) : formatted;
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

/** Scores are always whole numbers on a 0–100 scale (SCORING.md section 1). */
export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return String(Math.round(value));
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Time remaining, used by SLA countdowns. Returns a negative-aware label so an
 * expired deadline reads "2h overdue" rather than "in -2 hours".
 */
export function formatTimeRemaining(deadline: string | Date | null | undefined): string {
  if (!deadline) return '—';
  const target = typeof deadline === 'string' ? new Date(deadline) : deadline;
  if (Number.isNaN(target.getTime())) return '—';

  const diffMs = target.getTime() - Date.now();
  const overdue = diffMs < 0;
  const minutes = Math.floor(Math.abs(diffMs) / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let label: string;
  if (days >= 1) label = `${days}d ${hours % 24}h`;
  else if (hours >= 1) label = `${hours}h ${minutes % 60}m`;
  else label = `${minutes}m`;

  return overdue ? `${label} overdue` : `${label} left`;
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: 'auto' });
  const divisions: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.34524, 'week'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ];

  let duration = seconds;
  for (const [amount, unit] of divisions) {
    if (Math.abs(duration) < amount) return formatter.format(Math.round(duration), unit);
    duration /= amount;
  }
  return formatter.format(Math.round(duration), 'year');
}

/** Turn an enum-ish value such as PRIME_CONTRACTOR into "Prime contractor". */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return '—';
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}
