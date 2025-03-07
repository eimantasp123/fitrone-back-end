const mongoose = require("mongoose");

// Define the schema for feedback
const plansSchema = new mongoose.Schema({
  plan: {
    type: String,
    required: true,
    enum: ["base", "basic", "pro", "premium"], // Restricts the possible values
  },
  key: { type: String },
  price: { type: Number, required: true },
  currency: {
    type: String,
    required: true,
    enum: ["usd", "eur", "gbp"],
  },
  features: {
    ingredients_limit: {
      type: Number,
      required: true,
      default: -1, // Use null for unlimited
    },
    meals_limit: {
      type: Number,
      required: true,
      default: -1, // Use null for unlimited
    },
    weekly_menus_limit: {
      type: Number,
      required: true,
      default: -1,
    },
    clients_limit: {
      type: Number,
      required: true,
      default: -1,
    },
    weekly_plan_menu_limit: {
      type: Number,
      required: true,
      default: -1,
    },
    ai_search: {
      type: Boolean,
      required: true,
      default: false,
    },
    client_request_form: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
});

const Plans = mongoose.model("Plans", plansSchema);
module.exports = Plans;
