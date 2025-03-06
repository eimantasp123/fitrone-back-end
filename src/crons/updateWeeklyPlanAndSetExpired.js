const { getWeek } = require("date-fns/getWeek");
const { getYear } = require("date-fns/getYear");
const WeeklyPlan = require("../models/WeeklyPlan.js");
const WeeklyMenu = require("../models/WeeklyMenu.js");
const cron = require("node-cron");
const SingleDayOrder = require("../models/SingleDayOrder.js");

// Cron Job - Runs Every Monday at 14:00 UTC
cron.schedule("0 14 * * 1", () => updateWeeklyPlanAndSetExpired());

// cron.schedule("*/5 * * * * *", async () => updateWeekPlanAndSetExpired());

const updateWeeklyPlanAndSetExpired = async () => {
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

    console.log("✅ WeekPlan snapshots created successfully!");
    console.log("🗑 Setting expired Single Day Orders...");

    // Get all single day orders for the expired weeks and set them to `expired`
    const singleDayOrders = await SingleDayOrder.find({
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

    console.log("✅ Single Day Orders set to expired successfully!");

    console.log("🗑 Removing expired weeks from WeeklyMenu...");

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
    console.error(
      "Error during deep copy of week plan and change flags:",
      error,
    );
  }
};

// updateWeeklyPlanAndSetExpired();
