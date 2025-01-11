const connectDB = require("../config/dbConfig");
const WeeklyMenu = require("../models/WeeklyMenu");
const WeekPlan = require("../models/WeekPlan");
const { startOfWeek, endOfWeek, addWeeks } = require("date-fns");

// Utility function to generate week ranges
const generateWeekRanges = () => {
  const today = new Date();
  const weeks = [];

  // Generate weeks for the past month (4 weeks back)
  for (let i = -4; i < 0; i++) {
    const startDate = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
    const endDate = endOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
    weeks.push({ startDate, endDate });
  }

  // Generate weeks for the current month (4 weeks)
  for (let i = 0; i < 4; i++) {
    const startDate = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
    const endDate = endOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
    weeks.push({ startDate, endDate });
  }

  // Generate weeks for the next month (4 weeks forward)
  for (let i = 4; i < 8; i++) {
    const startDate = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
    const endDate = endOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
    weeks.push({ startDate, endDate });
  }

  return weeks;
};

// Utility function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const seedWeekPlans = async () => {
  try {
    await connectDB();

    const userId = "674f3d2abd2012ba7e4a7f01"; // Replace with the user's ID

    await WeekPlan.deleteMany({ user: userId });

    // Fetch all weekly menus created by the user
    const weeklyMenus = await WeeklyMenu.find({ user: userId });
    if (weeklyMenus.length === 0) {
      console.error(
        "No weekly menus found. Please seed weekly menus before running this script.",
      );
      return;
    }

    console.log(`Found ${weeklyMenus.length} weekly menus for user ${userId}.`);

    const weekRanges = generateWeekRanges();

    for (const week of weekRanges) {
      const randomMenu = weeklyMenus
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * 8) + 1);

      const assignMenu = randomMenu.map((menu) => ({
        menu: menu._id,
        assignedGroups: [],
        assignedClients: [],
      }));

      const weekPlan = {
        user: userId,
        startDate: week.startDate,
        endDate: week.endDate,
        assignMenu,
      };

      await WeekPlan.create(weekPlan);
      console.log(`Week plan created for ${week.startDate} - ${week.endDate}.`);

      await delay(200); // Delay for 1 second
    }

    console.log("Week plans seeded successfully.");
  } catch (error) {
    console.error(error);
  }
};

seedWeekPlans();
