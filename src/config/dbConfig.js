const mongoose = require("mongoose");
const WeeklyMenu = require("../models/WeeklyMenu");

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/testdb");
    console.log("MongoDB connected");

    // Rebuild indexes for WeeklyMenu
    await WeeklyMenu.syncIndexes(); // Ensure indexes are in sync
    console.log("Indexes created successfully.");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

module.exports = connectDB;
