const mongoose = require("mongoose");
const connectDB = require("../config/dbConfig");
const UserIngredient = require("../models/UserIngredient");
const { ingredients } = require("./data/ingredients");

// Array of 20 ingredients to add

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
