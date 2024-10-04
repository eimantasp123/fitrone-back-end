const mongoose = require("mongoose");

const dietPlanBalanceSchema = new mongoose.Schema({
  age: { type: Number, required: true },
  gender: { type: String, required: true },
  height: { type: Number, required: true },
  weight: { type: Number, required: true },
  fitnessGoal: { type: String, required: true },
  weightGoals: { type: Number },
  physicalActivityLevel: { type: String, required: true },
  dietaryPreferences: { type: String, required: true },
  dietaryRestrictions: { type: String },
  foodAllergies: { type: String },
  mealsPerDay: { type: Number, required: true },
  snacksPerDay: { type: Number, required: true },
  favoriteFoods: { type: String },
  foodsToAvoid: { type: String },
  medicalConditions: { type: String },
  medications: { type: String },
  sleepPatterns: { type: String, required: true },
  stressLevels: { type: String, required: true },
  hydration: { type: Number, required: true },
  alcoholConsumption: { type: String, required: true },
  smoking: { type: String, required: true },
  nutritionInfo: {
    kcal: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fat: { type: Number, required: true },
    protein: { type: Number, required: true },
  },
});

const DietPlanBalance = mongoose.model(
  "DietPlanBalance",
  dietPlanBalanceSchema,
);
module.exports = DietPlanBalance;
