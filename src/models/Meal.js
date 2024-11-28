const mongoose = require("mongoose");

const mealSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxLength: 70,
    },
    description: {
      type: String,
      maxLength: 500,
    },
    image: {
      type: String,
      default: "https://fitronelt.s3.eu-north-1.amazonaws.com/cb169cd415.jpg",
    },
    ingredients: [
      {
        ingredientId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "UserIngredient",
          required: true,
        },
        title: { type: String, required: true },
        currentAmount: { type: Number, required: true },
        unit: { type: String, required: true },
        calories: { type: Number, required: true },
        protein: { type: Number, required: true },
        fat: { type: Number, required: true },
        carbs: { type: Number, required: true },
      },
    ],
    nutrition: {
      calories: {
        type: Number,
        required: true,
      },
      protein: {
        type: Number,
        required: true,
      },
      fat: {
        type: Number,
        required: true,
      },
      carbs: {
        type: Number,
        required: true,
      },
    },
    preferences: {
      type: [String],
      default: [],
    },
    restrictions: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const Meal = mongoose.model("Meal", mealSchema);

module.exports = Meal;
