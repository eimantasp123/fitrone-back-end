const mongoose = require("mongoose");
const Plan = require("../models/Plans"); // Adjust the path to your model
const connectDB = require("../config/dbConfig");

const plans = [
  {
    plan: "base",
    features: {
      ingredients_limit: 0,
      meals_limit: 0,
      meal_week_types_limit: 0,
      clients_limit: 0,
      use_ai_search: false,
      business_page: false,
      individual_request_form: false,
      order_processing_simulations: false,
      weekly_reports: false,
    },
  },
  {
    plan: "basic",
    features: {
      ingredients_limit: 100,
      meals_limit: 50,
      meal_week_types_limit: 2,
      clients_limit: 10,
      use_ai_search: false,
      business_page: false,
      individual_request_form: false,
      order_processing_simulations: false,
      weekly_reports: false,
    },
  },
  {
    plan: "pro",
    features: {
      ingredients_limit: 500,
      meals_limit: 200,
      meal_week_types_limit: 5,
      clients_limit: 50,
      use_ai_search: true,
      business_page: true,
      individual_request_form: true,
      order_processing_simulations: true,
      weekly_reports: true,
    },
  },
  {
    plan: "premium",
    features: {
      ingredients_limit: -1, // Unlimited
      meals_limit: -1, // Unlimited
      meal_week_types_limit: -1, // Unlimited
      clients_limit: -1,
      use_ai_search: true,
      business_page: true,
      individual_request_form: true,
      order_processing_simulations: true,
      weekly_reports: true,
    },
  },
];

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
