require("dotenv").config(); // Load environment variables

const mongoose = require("mongoose");
const Plan = require("../models/Plans"); // Adjust the path to your model
const connectDB = require("../config/dbConfig");
const { plans } = require("./data/plans");

const seedPlans = async () => {
  try {
    await connectDB();

    await Plan.deleteMany();
    console.log("Old plans removed");

    await Plan.insertMany(plans);
    console.log("Plans have been successfully inserted!");
  } catch (error) {
    console.error("Error inserting plans: ", error);
  } finally {
    mongoose.disconnect();
  }
};

seedPlans();
