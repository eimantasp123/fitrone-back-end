require("dotenv").config(); // Load environment variables

const connectDB = require("../config/dbConfig");
const WeeklyMenu = require("../models/WeeklyMenu");
const WeeklyPlan = require("../models/WeeklyPlan");
const {
  addWeeks,
  startOfISOWeek,
  isBefore,
  getYear,
  getWeek,
} = require("date-fns");

// Utility function to generate week ranges
const generateWeekAndYear = (startDate, endDate) => {
  let weeksAndYears = [];
  let currentDate = startOfISOWeek(new Date(startDate));

  while (
    isBefore(
      currentDate,
      new Date(endDate) ||
        currentDate.toDateString() === new Date(endDate).toDateString(),
    )
  ) {
    weeksAndYears.push({
      year: getYear(currentDate),
      week: getWeek(currentDate),
    });

    currentDate = addWeeks(currentDate, 1);
  }

  return weeksAndYears;
};

// Utility function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const seedWeeklyPlans = async () => {
  try {
    await connectDB();

    const userId = process.env.TEST_USER_ID; // The user's ID

    await WeeklyPlan.deleteMany({ user: userId });

    // Fetch all weekly menus created by the user
    const weeklyMenus = await WeeklyMenu.find({ user: userId });
    if (weeklyMenus.length === 0) {
      console.error(
        "No weekly menus found. Please seed weekly menus before running this script.",
      );
      return;
    }

    console.log(`Found ${weeklyMenus.length} weekly menus for user ${userId}.`);

    const weekAndYear = generateWeekAndYear("2025-02-08", "2025-03-15");

    for (const item of weekAndYear) {
      const randomMenu = weeklyMenus
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * 8) + 1);

      const assignMenu = randomMenu.map((menu) => ({
        menu: menu._id,
        assignedGroups: [],
        assignedClients: [],
        activeWeeks: [],
      }));

      if (assignMenu.length !== 0) {
        for (const menu of assignMenu) {
          await WeeklyMenu.findByIdAndUpdate(menu.menu, {
            $push: { activeWeeks: { year: item.year, weekNumber: item.week } },
            $set: { status: "active" },
          });
        }
      }

      const weekPlan = {
        user: userId,
        year: item.year,
        weekNumber: item.week,
        assignMenu,
      };

      await WeeklyPlan.create(weekPlan);
      console.log(`Week plan created for ${item.year} - ${item.week}.`);

      await delay(200); // Delay for 1 second
    }

    console.log("Week plans seeded successfully.");
  } catch (error) {
    console.error(error);
  }
};

seedWeeklyPlans();

exports.module = seedWeeklyPlans;
