// require("dotenv").config(); // Load environment variables

const mongoose = require("mongoose");
const WeeklyMenu = require("../models/WeeklyMenu");
const Meal = require("../models/Meal");
const Ingredient = require("../models/Ingredient");
const Customer = require("../models/Customer");
const WeekPlan = require("../models/WeeklyPlan");

const connectDB = async () => {
  try {
    console.log("Connecting to MongoDB...");
    console.log(process.env.MONGO_DB_CONNECTION_STRING);
    await mongoose.connect(process.env.MONGO_DB_CONNECTION_STRING);
    console.log("MongoDB connected");

    // Rebuild indexes for WeeklyMenu
    await WeeklyMenu.syncIndexes(); // Ensure indexes are in sync

    // Rebuild indexes for Meal
    await Meal.syncIndexes(); // Ensure indexes are in sync

    // Rebuild indexes for Ingredient
    await Ingredient.syncIndexes(); // Ensure indexes are in sync

    // Create indexes for Customer
    await Customer.createIndexes(); // Ensure indexes are in sync

    // Create indexes for WeekPlan
    await WeekPlan.createIndexes(); // Ensure indexes are in sync
    console.log("Indexes created successfully.");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

module.exports = connectDB;
