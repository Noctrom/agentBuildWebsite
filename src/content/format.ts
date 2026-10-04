import type { YearMonth } from './types'

// Fixed English month names: output never depends on the visitor's locale or
// time zone (no Date parsing, so no off-by-one-month shifts).
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** Label used for an open-ended range (`end: null`). */
export const PRESENT_LABEL = 'Present'

/**
 * Format a `YearMonth` for display: `formatYearMonth('2023-03')` → `'Mar 2023'`.
 * Falls back to the raw value if it isn't a valid `YYYY-MM` string.
 */
export function formatYearMonth(value: YearMonth): string {
  const match = /^(\d{4})-(\d{1,2})$/.exec(value)
  if (!match) return value
  const month = MONTHS[Number(match[2]) - 1]
  return month ? `${month} ${match[1]}` : value
}

/**
 * Format a start/end range: `formatDateRange('2023-03', null)` →
 * `'Mar 2023 – Present'`. `end: null` means the role/course is ongoing.
 */
export function formatDateRange(start: YearMonth, end: YearMonth | null): string {
  return `${formatYearMonth(start)} – ${end === null ? PRESENT_LABEL : formatYearMonth(end)}`
}
