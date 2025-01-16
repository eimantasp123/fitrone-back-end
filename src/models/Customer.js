const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    firtName: { type: String },
    lastName: { type: String },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "active",
    },
    phone: { type: String },
    age: { type: Number },
    gender: { type: String },
    height: { type: Number },
    weight: { type: Number },
    fitnessGoal: { type: String },
    weightGoals: { type: Number },
    physicalActivityLevel: { type: String },
    dietaryPreferences: {
      type: [String],
      default: [],
      enum: {
        values: [
          "vegetarian",
          "vegan",
          "pescatarian",
          "flexitarian",
          "paleo",
          "keto",
          "lowCarb",
          "mediterranean",
          "highProtein",
          "plantBased",
          "balanced",
          "spicy",
          "sweet",
        ],
        message: "invalidPreference",
      },
    },
    dietaryRestrictions: {
      type: [String],
      default: [],
      enum: {
        values: [
          "glutenFree",
          "dairyFree",
          "nutFree",
          "eggFree",
          "soyFree",
          "shellfishFree",
          "halal",
          "kosher",
          "lowSodium",
          "sugarFree",
        ],
        message: "invalidRestriction",
      },
    },
    foodAllergies: { type: String },
    address: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

const Customer = mongoose.model("Customer", customerSchema);
module.exports = Customer;
