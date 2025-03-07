const WeeklyPlan = require("../models/WeeklyPlan.js");
const WeeklyMenu = require("../models/WeeklyMenu.js");
const SingleDayOrder = require("../models/SingleDayOrder.js");
const User = require("../models/User.js");
const { getWeek } = require("date-fns/getWeek");
const { getYear } = require("date-fns/getYear");
const { formatInTimeZone } = require("date-fns-tz");

/**
 * Function to process weekly plans, single day orders, weekly menus and set expired for a user
 * @param {string} userId - The user ID
 */
const updateWeeklyPlanAndSetExpired = async (userId) => {
  // Get the current year and week number in UTC time
  const now = new Date();
  const currentYear = getYear(now);

  // Force ISO week standard (Monday start)
  const currentWeek = getWeek(now, { weekStartsOn: 1 });

  // Calculate the minimum week to expire (last 4 weeks)
  const minExpiredWeek = currentWeek - 4;
  const minExpiredYear = minExpiredWeek > 0 ? currentYear : currentYear - 1;
  const adjustedWeek =
    minExpiredWeek > 0 ? minExpiredWeek : 52 + minExpiredWeek; // Handle negative week values (previous year)

  try {
    // Find expired Week Plans to create snapshots
    const expiredWeeklyPlans = await WeeklyPlan.find({
      user: userId,
      $or: [
        { year: { $lt: minExpiredYear } }, // Expire past years
        {
          year: minExpiredYear,
          weekNumber: { $gte: adjustedWeek, $lt: currentWeek },
        }, // Expire past 4 weeks in the last year
        { year: currentYear, weekNumber: { $lt: currentWeek } }, // Expire past weeks in current year
      ],
      status: "active",
    }).populate({
      path: "assignMenu.menu",
    }); // Populate asignMenu.menu details

    for (const weeklyPlan of expiredWeeklyPlans) {
      weeklyPlan.assignMenu.forEach((menuItem) => {
        if (menuItem.menu) {
          menuItem.menuSnapshot = JSON.parse(JSON.stringify(menuItem.menu)); // Deep Copy
        }
      });

      weeklyPlan.status = "expired";
      weeklyPlan.isSnapshot = true;

      await weeklyPlan.save({ validateBeforeSave: true }); // Save updated snapshot
    }

    // Get all single day orders for the expired weeks and set them to `expired`
    const singleDayOrders = await SingleDayOrder.find({
      user: userId,
      $or: [
        { year: { $lt: minExpiredYear } },
        {
          year: minExpiredYear,
          weekNumber: { $gte: adjustedWeek, $lt: currentWeek },
        },
        {
          year: currentYear,
          weekNumber: { $lt: currentWeek },
        },
      ],
      expired: false,
    }).populate({
      path: "categories.meals.weeklyMenu",
    });

    // Update single day orders
    for (const singleDayOrder of singleDayOrders) {
      // Set all meals to `done`
      singleDayOrder.categories = singleDayOrder.categories.map((category) => {
        return {
          ...category,
          meals: category.meals.map((meal) => {
            return {
              ...meal,
              status: "done",
              weeklyMenuTitle: meal.weeklyMenu.title,
            };
          }),
        };
      });

      singleDayOrder.expired = true;
      singleDayOrder.status = "done";

      // Save the updated single day order
      await singleDayOrder.save({ validateBeforeSave: true });
    }

    // Remove expired weeks from WeeklyMenu
    await WeeklyMenu.updateMany(
      {
        user: userId,
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

    // Set `inactive` for menus with empty `activeWeeks`
    await WeeklyMenu.updateMany(
      {
        user: userId,
        activeWeeks: { $size: 0 },
      }, // If `activeWeeks` array is now empty
      { $set: { status: "inactive" } },
    );
  } catch (error) {
    console.error(
      "Error during deep copy of week plan and change flags:",
      error,
    );
  }
};

/**
 * Function to update weekly plans, single day orders and set expired for users
 * @param {string[]} userIds - The user IDs
 */
const updateWeeklyPlanAndSetExpiredForUsers = async (userIds) => {
  // Update weekly plan and set expired for each user
  await Promise.all(
    userIds.map(async (userId) => {
      await updateWeeklyPlanAndSetExpired(userId);
    }),
  );
};

/**
 * Function to check if it's Monday 00:15 AM in the given timezone
 * @param {string} timezone - The timezone
 * @param {Date} date - The date to check
 * @returns {boolean} - True if it's Monday 00:15 AM in the given timezone
 */
const isMondayMidnight = (timezone, date = new Date()) => {
  const localDay = parseInt(formatInTimeZone(date, timezone, "i"), 10); // ISO weekday (1 = Monday, 7 = Sunday)
  const localHour = parseInt(formatInTimeZone(date, timezone, "H"), 10); // 0-23 hours
  return localDay === 1 && localHour === 0; // Monday at 00:00
};

/**
 * Function to process users and update weekly plans for the correct timezones
 */
const processWeeklyPlans = async () => {
  // Fetch all users with a timezone
  const users = await User.find({
    timezone: { $ne: null },
    role: "supplier",
  }).select("_id timezone");

  // Group users by timezone for processing
  const usersByTimezone = users.reduce((acc, user) => {
    if (!acc[user.timezone]) {
      acc[user.timezone] = [];
    }
    acc[user.timezone].push(user._id); // Add user ID to the timezone group
    return acc;
  }, {});

  // Process weekly plans for each timezone group
  for (const [timezone, userIds] of Object.entries(usersByTimezone)) {
    // Check if it's Monday midnight in the user's timezone
    if (isMondayMidnight(timezone)) {
      // Update weekly plans and set expired for users weekly plans and single day orders
      await updateWeeklyPlanAndSetExpiredForUsers(userIds);
    }
  }
};

module.exports = {
  isMondayMidnight,
  processWeeklyPlans,
  updateWeeklyPlanAndSetExpired,
  updateWeeklyPlanAndSetExpiredForUsers,
};
