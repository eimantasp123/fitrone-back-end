require("dotenv").config(); // Load environment variables

const mongoose = require("mongoose");
const connectDB = require("../config/dbConfig");
const Customer = require("../models/Customer");
const { customers } = require("./data/customers");

// Utility function to add delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Seed ingredients into the database
const seedMultipleCustomers = async () => {
  try {
    await connectDB(); // Connect to the database

    const userId = process.env.TEST_USER_ID; // The user's ID

    // Delete existing ingredients and meals for the user
    await Customer.deleteMany({ supplier: userId });

    // Insert ingredients into the database
    for (const customer of customers) {
      await Customer.create({ ...customer, supplier: userId });
      console.log(`Inserted customer: ${customer.firstName}`);
      await delay(200); // 200ms delay between each ingredient insertion
    }

    console.log("Customers have been uccessfully added!");
  } catch (error) {
    console.error("Error inserting customers: ", error);
  } finally {
    mongoose.disconnect(); // Disconnect from the database
  }
};

seedMultipleCustomers();

module.exports = seedMultipleCustomers;
