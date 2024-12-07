const mongoose = require("mongoose");

// Define the schema for feedback
const plansSchema = new mongoose.Schema({
  plan: {
    type: String,
    required: true,
    enum: ["base", "basic", "pro", "premium"], // Restricts the possible values
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
    meal_week_types_limit: {
      type: Number,
      required: true,
      default: -1,
    },
    clients_limit: {
      type: Number,
      required: true,
      default: -1,
    },
    use_ai_search: {
      type: Boolean,
      required: true,
      default: false,
    },
    business_page: {
      type: Boolean,
      required: true,
      default: false,
    },
    individual_request_form: {
      type: Boolean,
      required: true,
      default: false,
    },
    order_processing_simulations: {
      type: Boolean,
      required: true,
      default: false,
    },
    weekly_reports: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
});

const Plans = mongoose.model("Plans", plansSchema);
module.exports = Plans;
