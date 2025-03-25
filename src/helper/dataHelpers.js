const { toZonedTime } = require("date-fns-tz");
const { getISOWeek } = require("date-fns/getISOWeek");
const { getISOWeekYear } = require("date-fns/getISOWeekYear");

/**
 * Check if a timezone string is valid.
 * @param {string} timezone - User's IANA timezone string
 * @returns {boolean} - True if the timezone is valid, false otherwise
 */
function isValidTimezone(timezone) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Get a safe timezone string for date-fns-tz functions.
 * If the timezone is invalid, return "UTC" as a fallback.
 * @param {string} tz - User's IANA timezone string
 * @returns {string} - Safe timezone string
 */
function getSafeTimezone(tz) {
  return isValidTimezone(tz) ? tz : "UTC";
}

/**
 * Checks if a requested ISO week/year is expired based on user's local timezone.
 *
 * A week is considered expired only if it is *before* the user's current ISO week.
 * Even if it's Sunday night, the current week is still valid.
 *
 * @param {number} year - ISO year of the requested week
 * @param {number} week - ISO week number (1–53)
 * @param {string} timezone - User's IANA timezone string
 * @param {Date} [mockDate] - Optional override for "now"
 * @returns {boolean} - True if the week is expired, false otherwise
 */
function isWeekExpired(year, week, timezone, mockDate) {
  const now = toZonedTime(mockDate || new Date(), getSafeTimezone(timezone));
  const currentWeek = getISOWeek(now);
  const currentYear = getISOWeekYear(now);

  if (year < currentYear) return true;
  if (year > currentYear) return false;

  // same year, compare weeks
  return week < currentWeek;
}

module.exports = { isWeekExpired, isValidTimezone };
