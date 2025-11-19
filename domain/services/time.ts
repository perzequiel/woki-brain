export function isISODateTime(str: string): boolean {
  // Simple check: valid date string and contains 'T'
  return typeof str === 'string' && !isNaN(Date.parse(str)) && str.includes('T');
}

/**
 * Aligns a date to the 15-minute grid.
 * Rounds down to the nearest 15-minute mark.
 *
 * @param date - Date to align
 * @returns Date aligned to 15-minute grid (seconds and milliseconds set to 0)
 *
 * @example
 * 20:07 → 20:00
 * 20:23 → 20:15
 * 20:30 → 20:30
 */
export function alignToGrid(date: Date): Date {
  const aligned = new Date(date);
  const minutes = aligned.getMinutes();
  const alignedMinutes = Math.floor(minutes / 15) * 15;
  aligned.setMinutes(alignedMinutes);
  aligned.setSeconds(0);
  aligned.setMilliseconds(0);
  return aligned;
}

/**
 * Aligns a date to the next 15-minute grid slot (rounds up).
 *
 * @param date - Date to align
 * @returns Date aligned to next 15-minute grid slot
 *
 * @example
 * 20:07 → 20:15
 * 20:23 → 20:30
 * 20:30 → 20:30 (already aligned)
 */
export function alignToNextGrid(date: Date): Date {
  const aligned = new Date(date);
  const minutes = aligned.getMinutes();
  const alignedMinutes = Math.ceil(minutes / 15) * 15;
  aligned.setMinutes(alignedMinutes);
  aligned.setSeconds(0);
  aligned.setMilliseconds(0);
  return aligned;
}

/**
 * Validates that a duration is a multiple of 15 minutes and within valid range.
 *
 * @param durationMinutes - Duration to validate
 * @param minMinutes - Minimum duration (default: 30)
 * @param maxMinutes - Maximum duration (default: 180)
 * @returns true if valid, false otherwise
 */
export function isValidDuration(
  durationMinutes: number,
  minMinutes: number = 30,
  maxMinutes: number = 180
): boolean {
  return (
    durationMinutes >= minMinutes && durationMinutes <= maxMinutes && durationMinutes % 15 === 0
  );
}

/**
 * Converts a time string (HH:mm) to a Date on the given date.
 *
 * @param date - Base date (YYYY-MM-DD)
 * @param time - Time string (HH:mm)
 * @returns Date object with the time set
 */
export function timeStringToDate(date: string, time: string): Date {
  const dateObj = new Date(`${date}T${time}:00`);
  return dateObj;
}
