import { format } from 'date-fns';

export const APP_TIMEZONE = 'America/New_York';

/**
 * Format a date to a locale string in US Eastern Time.
 */
export function toETLocaleString(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleString('en-US', { timeZone: APP_TIMEZONE, ...options });
}

/**
 * Format a date to a locale date string in US Eastern Time.
 */
export function toETLocaleDateString(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleDateString('en-US', { timeZone: APP_TIMEZONE, ...options });
}

/**
 * Format a date to a locale time string in US Eastern Time.
 */
export function toETLocaleTimeString(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleTimeString('en-US', { timeZone: APP_TIMEZONE, ...options });
}

/**
 * Format a date using date-fns format() but shifted to US Eastern Time.
 * This converts the UTC date to an ET-adjusted Date object before formatting.
 */
export function formatET(date: string | Date, formatStr: string) {
  const d = new Date(date);
  const etStr = d.toLocaleString('en-US', { timeZone: APP_TIMEZONE });
  const etDate = new Date(etStr);
  return format(etDate, formatStr);
}
