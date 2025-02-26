require("dotenv").config(); // Load environment variables

const connectDB = require("../config/dbConfig");
const SingleDayOrder = require("../models/SingleDayOrder");
const WeeklyPlan = require("../models/WeeklyPlan");

const seedWeeklyPlansOrders = async () => {
  try {
    await connectDB();

    const userId = process.env.TEST_USER_ID; // The user's ID

    await SingleDayOrder.deleteMany({ user: userId });

    const WeeklyPlanDetails = await WeeklyPlan.findOne({
      user: userId,
      status: "expired",
    })
      .sort({ createdAt: -1 })
      .populate("assignMenu.menu");

    const assignedWeeklyMenu = WeeklyPlanDetails.assignMenu[0];

    console.log("assignedWeeklyMenu", assignedWeeklyMenu.menu);

    // Create new single day orders
    const newOrders = assignedWeeklyMenu.menu.days.map((day) => {
      // Create category map which will be used to organize meals by category
      const categoryMap = new Map();

      // Map for each meal in the day
      for (const meal of day.meals) {
        const category = meal.category;

        // Create category if it doesn't exist
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            category,
            meals: [],
          });
        }

        // Add meal to category
        categoryMap.get(category).meals.push({
          meal: meal.meal,
          weeklyMenu: assignedWeeklyMenu.menu._id,
          status: "not_done",
          customers: assignedWeeklyMenu.assignedClients,
        });
      }

      // Return single day order object
      return {
        user: userId,
        year: WeeklyPlanDetails.year,
        weekNumber: WeeklyPlanDetails.weekNumber,
        day: day.day,
        categories: Array.from(categoryMap.values()),
      };
    });

    // Insert new single day orders
    await SingleDayOrder.insertMany(newOrders);

    console.log("Week plans seeded successfully.");
  } catch (error) {
    console.error(error);
  }
};

seedWeeklyPlansOrders();

exports.module = seedWeeklyPlansOrders;
