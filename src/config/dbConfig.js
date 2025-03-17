const mongoose = require("mongoose");

const WeeklyMenu = require("../models/WeeklyMenu");
const Meal = require("../models/Meal");
const Ingredient = require("../models/Ingredient");
const Customer = require("../models/Customer");
const WeekPlan = require("../models/WeeklyPlan");
const IngredientsStock = require("../models/IngredientsStock");
const SingleDayOrder = require("../models/SingleDayOrder");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_DB_CONNECTION_STRING);
    console.log("MongoDB connected");

    // Create indexes if REBUILD_INDEXES is set to true
    if (process.env.REBUILD_INDEXES === "true") {
      await Promise.all([
        Ingredient.createIndexes(),
        Meal.createIndexes(),
        WeeklyMenu.createIndexes(),
        WeekPlan.createIndexes(),
        IngredientsStock.createIndexes(),
        SingleDayOrder.createIndexes(),
        Customer.createIndexes(),
      ]);
      console.log("✅ Indexes created successfully!");
    }
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

module.exports = connectDB;
