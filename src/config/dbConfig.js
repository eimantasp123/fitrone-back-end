const mongoose = require("mongoose");
// const WeeklyMenu = require("../models/weeklyMenu");

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/testdb", {
      useNewUrlParser: true,
    });
    console.log("MongoDB connected");

    // mongoose.connection.once("open", async () => {
    //   console.log("Ensuring all indexes are created");
    //   await WeeklyMenu.createIndexes();
    // });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

module.exports = connectDB;
