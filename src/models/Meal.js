const mongoose = require("mongoose");

const ingredientSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  unit: {
    type: String,
    required: true,
  },
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
});

const nutritionSchema = new mongoose.Schema({
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
});

const mealSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // Link the meal to a specific user
    },
    title: {
      type: String,
      required: true, // The title of the meal
      maxLength: 70, // Maximum length of 70 characters
    },
    description: {
      type: String,
      maxLength: 500, // Maximum length of 200 characters
    },
    image: {
      type: String,
      default: "https://fitronelt.s3.eu-north-1.amazonaws.com/cb169cd415.jpg",
    },
    ingredients: {
      type: [ingredientSchema], // Array of ingredients
      required: true,
    },
    nutrition: {
      type: nutritionSchema, // Total nutrition of the meal
      required: true,
    },
    preferences: {
      type: [String], // Array of dietary preferences
      default: [],
    },
    restrictions: {
      type: [String], // Array of dietary restrictions
      default: [],
    },
    category: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Automatically handle `createdAt` and `updatedAt`
  },
);

const Meal = mongoose.model("Meal", mealSchema);

module.exports = Meal;
