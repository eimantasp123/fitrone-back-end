const { getWeek } = require("date-fns/getWeek");
const { getYear } = require("date-fns/getYear");
const WeekPlan = require("../models/WeekPlan.js");
const WeeklyMenu = require("../models/WeeklyMenu.js");
const cron = require("node-cron");

// Cron Job - Runs Every Monday at 14:00 UTC
cron.schedule("0 14 * * 1", () => updateWeekPlanAndSetExpired());

// cron.schedule("*/5 * * * * *", async () => updateWeekPlanAndSetExpired());

const updateWeekPlanAndSetExpired = async () => {
  // Get the current year and week number in UTC time
  const now = new Date();
  const currentYear = getYear(now);
  const currentWeek = getWeek(now);

  // Calculate the minimum week to expire (last 4 weeks)
  const minExpiredWeek = currentWeek - 4;
  const minExpiredYear = minExpiredWeek > 0 ? currentYear : currentYear - 1;
  const adjustedWeek =
    minExpiredWeek > 0 ? minExpiredWeek : 52 + minExpiredWeek; // Handle negative week values (previous year)

  try {
    // Expire Week Plans from the last 4 weeks only
    console.log("Expire Week Plans from the last 4 weeks only");
    await WeekPlan.updateMany(
      {
        $or: [
          { year: { $lt: minExpiredYear } }, // Expire past years
          {
            year: minExpiredYear,
            weekNumber: { $gte: adjustedWeek, $lt: currentWeek },
          }, // Expire past 4 weeks in the last year
          { year: currentYear, weekNumber: { $lt: currentWeek } }, // Expire past weeks in current year
        ],
      },
      { $set: { status: "expired", isSnapshot: true } },
    );

    console.log("Remove expired weeks from WeeklyMenu");

    // Remove expired weeks from WeeklyMenu
    await WeeklyMenu.updateMany(
      {
        $or: [
          { "activeWeeks.year": { $lt: minExpiredYear } },
          {
            "activeWeeks.year": minExpiredYear,
            "activeWeeks.weekNumber": { $gte: adjustedWeek, $lt: currentWeek },
          },
          {
            "activeWeeks.year": currentYear,
            "activeWeeks.weekNumber": { $lt: currentWeek },
          },
        ],
      },
      {
        $pull: {
          activeWeeks: {
            $or: [
              { year: { $lt: minExpiredYear } },
              {
                year: minExpiredYear,
                weekNumber: { $gte: adjustedWeek, $lt: currentWeek },
              },
              { year: currentYear, weekNumber: { $lt: currentWeek } },
            ],
          },
        },
      },
    );

    console.log("Set inactive for menus with empty activeWeeks");

    // Set `inactive` for menus with empty `activeWeeks`
    await WeeklyMenu.updateMany(
      { activeWeeks: { $size: 0 } }, // If `activeWeeks` array is now empty
      { $set: { status: "inactive" } },
    );

    console.log("WeekPlan expiration completed");
  } catch (error) {
    console.error("Error during cleanup for weekPlan expiration:", error);
  }
};
