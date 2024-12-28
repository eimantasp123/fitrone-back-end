const mongoose = require("mongoose");
const Plan = require("../models/Plans"); // Adjust the path to your model
const connectDB = require("../config/dbConfig");

const plans = [
  {
    plan: "base",
    key: "base-plan",
    price: 0,
    currency: "usd",
    features: {
      ingredients_limit: 0,
      meals_limit: 0,
      weekly_menus_limit: 0,
      weekly_plan_limit: 0,
      clients_limit: 0,
      ai_search: false,
      business_page: false,
      client_request_form: false,
      order_management: false,
      weekly_reports: false,
    },
  },
  {
    plan: "basic",
    key: "basic-plan",
    price: 19,
    currency: "usd",
    features: {
      ingredients_limit: 5,
      meals_limit: 3,
      weekly_menus_limit: 5,
      weekly_plan_limit: 10,
      clients_limit: 10,
      ai_search: false,
      business_page: false,
      client_request_form: false,
      order_management: false,
      weekly_reports: false,
    },
  },
  {
    plan: "pro",
    key: "pro-plan",
    price: 49,
    currency: "usd",
    features: {
      ingredients_limit: 10,
      meals_limit: 7,
      weekly_menus_limit: 10,
      weekly_plan_limit: 20,
      clients_limit: 50,
      ai_search: true,
      business_page: true,
      client_request_form: false,
      order_management: true,
      weekly_reports: false,
    },
  },
  {
    plan: "premium",
    key: "premium-plan",
    price: 99,
    currency: "usd",
    features: {
      ingredients_limit: -1,
      meals_limit: -1,
      meal_week_types_limit: -1,
      clients_limit: -1,
      ai_search: true,
      business_page: true,
      client_request_form: true,
      order_management: true,
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
