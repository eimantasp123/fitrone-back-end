require("dotenv").config(); // Load environment variables

const mongoose = require("mongoose");
const connectDB = require("../config/dbConfig");
const WeeklyMenu = require("../models/WeeklyMenu");
const { menuData } = require("./data/weeklyMenu");
const Meal = require("../models/Meal");
const { roundTo } = require("../helper/roundeNumber");

// Utility function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Seed ingredients into the database
const seedWeeklyMenu = async () => {
  try {
    await connectDB(); // Connect to the database

    const userId = process.env.TEST_USER_ID; // The user's ID

    // Delete existing weekly menus for the user
    await WeeklyMenu.deleteMany({ user: userId });
    console.log(`Existing weekly menus for user ${userId} have been deleted.`);

    // Fetch all meals created by the user
    const meals = await Meal.find({ user: userId });
    if (meals.length === 0) {
      console.error(
        "No meals found. Please seed meals before running this script.",
      );
      return;
    }

    console.log(`Found ${meals.length} meals for user ${userId}.`);

    // Iterate over menu data and create weekly menus
    for (const menu of menuData) {
      const defaultDays = Array.from({ length: 7 }, (_, i) => ({
        day: i,
        meals: [],
      }));

      // Randomly assign meals to days and calculate nutrition
      for (const day of defaultDays) {
        const assignMeals = Math.random() > 0.3; // 70% chance to assign meals to a day
        if (assignMeals) {
          const randomMeals = meals
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.floor(Math.random() * 3) + 1); // Assign 1-3 meals

          day.meals = randomMeals.map((meal) => ({
            category: meal.category,
            meal: meal._id,
          }));
        }
      }

      // Create a weekly menu object
      const weeklyMenu = {
        user: userId,
        title: menu.title,
        description: menu.description,
        archived: menu.archived ?? false,
        status: menu.status ?? "inactive",
        preferences: menu.preferences ?? [],
        restrictions: menu.restrictions ?? [],
        days: defaultDays,
      };

      // Insert the menu into the database
      await WeeklyMenu.create(weeklyMenu);
      console.log(`Inserted weekly menu: ${menu.title}`);

      // Add delay between each menu insertion
      await delay(200);
    }

    console.log("Weekly menus have been successfully added!");
  } catch (error) {
    console.error("Error inserting weekly menus: ", error);
  } finally {
    mongoose.disconnect(); // Disconnect from the database
  }
};

seedWeeklyMenu();

module.exports = seedWeeklyMenu;
