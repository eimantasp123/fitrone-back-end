const { addWeeks } = require("date-fns/addWeeks");
const { startOfISOWeek } = require("date-fns/startOfISOWeek");
const { startOfISOWeekYear } = require("date-fns/startOfISOWeekYear");
const { toZonedTime } = require("date-fns-tz");
const { isBefore } = require("date-fns/isBefore");

/**
 * Determines if a given ISO week in a specific year is expired
 * relative to the current moment in the user's timezone.
 *
 * @param {number} year - The ISO year (e.g., 2025)
 * @param {number} week - The ISO week number (1–53)
 * @param {string} timezone - An IANA timezone string (e.g., "Europe/Vilnius")
 * @returns {boolean} - True if the week is expired, false otherwise
 */
function isWeekExpired(year, week, timezone) {
  const dateNow = toZonedTime(new Date(), timezone);

  // Start of current ISO week in user's timezone
  const startOfCurrentWeek = startOfISOWeek(dateNow);

  // Set year and week
  const baseDate = new Date(`${year}-01-04`);
  const requestDate = addWeeks(startOfISOWeekYear(baseDate), week - 1);

  // Start of requested week in user's timezone
  const startOfRequestedWeek = startOfISOWeek(
    toZonedTime(requestDate, timezone),
  );

  return isBefore(startOfRequestedWeek, startOfCurrentWeek);
}
module.exports = { isWeekExpired };
