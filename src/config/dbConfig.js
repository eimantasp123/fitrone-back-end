// require("dotenv").config(); // Load environment variables

const mongoose = require("mongoose");
const WeeklyMenu = require("../models/WeeklyMenu");

const connectDB = async () => {
  try {
    console.log("Connecting to MongoDB...");
    console.log(process.env.MONGO_DB_CONNECTION_STRING);
    await mongoose.connect(process.env.MONGO_DB_CONNECTION_STRING);
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
