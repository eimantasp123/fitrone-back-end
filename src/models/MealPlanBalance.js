const mongoose = require("mongoose");

const mealPlanBalanceSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  age: { type: Number, required: true },
  gender: { type: String, required: true },
  height: { type: Number, required: true },
  weight: { type: Number, required: true },
  fitnessGoal: { type: String, required: true },
  weightGoals: { type: Number, default: null },
  physicalActivityLevel: { type: String, required: true },
  dietaryPreferences: { type: String, required: true },
  dietaryRestrictions: { type: String },
  foodAllergies: { type: String },
  nutritionInfo: {
    kcal: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fat: { type: Number, required: true },
    protein: { type: Number, required: true },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const MealPlanBalance = mongoose.model(
  "MealPlanBalance",
  mealPlanBalanceSchema,
);
module.exports = MealPlanBalance;
