require("dotenv").config(); // Load environment variables

const mongoose = require("mongoose");
const connectDB = require("../config/dbConfig");
const Ingredient = require("../models/Ingredient");

// Utility function to add delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Seed ingredients into the database
const seedIngredients = async () => {
  try {
    await connectDB(); // Connect to the database

    const userId = process.env.TEST_USER_ID; // The user's ID

    await Ingredient.deleteMany({ user: userId });

    let ingredients = [];
    for (let i = 0; i < 400; i++) {
      ingredients.push({
        title: { lt: `ingredient${i}`, en: `ingredient${i}` },
        unit: "g",
        amount: Math.floor(Math.random() * 200) + 50,
        calories: Math.floor(Math.random() * 500) + 10,
        protein: parseFloat((Math.random() * 10).toFixed(1)),
        fat: parseFloat((Math.random() * 10).toFixed(1)),
        carbs: parseFloat((Math.random() * 100).toFixed(1)),
      });
    }

    // Insert ingredients into the database
    for (const ingredient of ingredients) {
      await Ingredient.create({ ...ingredient, user: userId });
      console.log(`Inserted ingredient: ${ingredient.title.lt}`);
      await delay(50); // 200ms delay between each ingredient insertion
    }
    console.log("Ingredients have been successfully added!");
  } catch (error) {
    console.error("Error inserting ingredients: ", error);
  } finally {
    mongoose.disconnect(); // Disconnect from the database
  }
};

seedIngredients();
