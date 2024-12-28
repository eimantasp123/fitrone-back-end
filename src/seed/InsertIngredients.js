const mongoose = require("mongoose");
const connectDB = require("../config/dbConfig");
const UserIngredient = require("../models/UserIngredient");

// Array of 20 ingredients to add
const ingredients = [
  {
    title: { lt: "obuolys", en: "apple" },
    unit: "g",
    amount: 100,
    calories: 52,
    protein: 0.3,
    fat: 0.2,
    carbs: 14,
  },
  {
    title: { lt: "bananas", en: "banana" },
    unit: "g",
    amount: 120,
    calories: 105,
    protein: 1.3,
    fat: 0.3,
    carbs: 27,
  },
  {
    title: { lt: "morka", en: "carrot" },
    unit: "g",
    amount: 100,
    calories: 41,
    protein: 0.9,
    fat: 0.2,
    carbs: 10,
  },
  {
    title: { lt: "braškės", en: "strawberries" },
    unit: "g",
    amount: 150,
    calories: 49,
    protein: 1.0,
    fat: 0.5,
    carbs: 12,
  },
  {
    title: { lt: "avokadas", en: "avocado" },
    unit: "g",
    amount: 100,
    calories: 160,
    protein: 2,
    fat: 15,
    carbs: 9,
  },
  {
    title: { lt: "bulvė", en: "potato" },
    unit: "g",
    amount: 150,
    calories: 110,
    protein: 3,
    fat: 0.2,
    carbs: 26,
  },
  {
    title: { lt: "cukinija", en: "zucchini" },
    unit: "g",
    amount: 100,
    calories: 17,
    protein: 1.2,
    fat: 0.3,
    carbs: 3.1,
  },
  {
    title: { lt: "brokoliai", en: "broccoli" },
    unit: "g",
    amount: 150,
    calories: 50,
    protein: 4.2,
    fat: 0.6,
    carbs: 9.8,
  },
  {
    title: { lt: "pomidoras", en: "tomato" },
    unit: "g",
    amount: 100,
    calories: 18,
    protein: 0.9,
    fat: 0.2,
    carbs: 3.9,
  },
  {
    title: { lt: "agurkas", en: "cucumber" },
    unit: "g",
    amount: 150,
    calories: 22,
    protein: 0.8,
    fat: 0.1,
    carbs: 4.3,
  },
];

// Seed ingredients into the database
const seedIngredients = async () => {
  try {
    await connectDB(); // Connect to the database

    const userId = "674f3d2abd2012ba7e4a7f01"; // The user's ID

    // Find or create the user document
    let userIngredients = await UserIngredient.findOne({ user: userId });

    if (!userIngredients) {
      // If the user's ingredient document doesn't exist, create it
      userIngredients = await UserIngredient.create({
        user: userId,
        ingredients: [],
      });
    }

    // Clear all existing ingredients
    userIngredients.ingredients = [];

    // Add ingredients to the user's document
    userIngredients.ingredients.push(...ingredients);

    // Save the updated document
    await userIngredients.save();

    console.log("Ingredients have been successfully added!");
  } catch (error) {
    console.error("Error inserting ingredients: ", error);
  } finally {
    mongoose.disconnect(); // Disconnect from the database
  }
};

seedIngredients();
