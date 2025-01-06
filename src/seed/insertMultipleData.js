const mongoose = require("mongoose");
const connectDB = require("../config/dbConfig");
const { ingredients } = require("./data/ingredients");
const Ingredient = require("../models/Ingredient");
const Meal = require("../models/Meal");
const {
  mealPreferences,
  mealRestrictions,
  mealCategories,
  mealTitleAndDescriptionData,
} = require("./data/meals");
const { roundTo } = require("../helper/roundeNumber");

// Utility function to add delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Seed ingredients into the database
const seedMultiple = async () => {
  try {
    await connectDB(); // Connect to the database

    const userId = "674f3d2abd2012ba7e4a7f01"; // The user's ID eimantaspetrikas18
    // const userId = "6737e6460dd6907c4fd14e72"; // The user's ID eimiuxxx09

    // Delete existing ingredients and meals for the user
    await Ingredient.deleteMany({ user: userId });
    await Meal.deleteMany({ user: userId });
    console.log(
      `Existing ingredients and meals for user ${userId} have been deleted.`,
    );

    // Insert ingredients into the database
    for (const ingredient of ingredients) {
      await Ingredient.create({ ...ingredient, user: userId });
      console.log(`Inserted ingredient: ${ingredient.title.lt}`);
      await delay(200); // 200ms delay between each ingredient insertion
    }

    // Fetch all newly inserted ingredients
    const allIngredients = await Ingredient.find({ user: userId });

    // Prepare meals data
    const meals = mealTitleAndDescriptionData.map((meal) => {
      // Select random category
      const category =
        mealCategories[Math.floor(Math.random() * mealCategories.length)];

      // Select random preferences and restrictions
      const preferences = mealPreferences
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * 3)); // Max 3 preferences
      const restrictions = mealRestrictions
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * 3)); // Max 3 restrictions

      // Select random ingredients (2-5 ingredients per meal)
      const randomIngredients = allIngredients
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * 4) + 2); // 2 to 5 ingredients

      // Calculate total nutrition
      const ingredientDetails = randomIngredients.map((ingredient) => {
        const scalingFactor = Math.random() * 0.5 + 0.5; // Random scaling factor (50% to 100%)
        return {
          ingredientId: ingredient._id,
          title: ingredient.title.lt,
          currentAmount: Math.round(ingredient.amount * scalingFactor),
          unit: ingredient.unit,
          calories: roundTo(ingredient.calories * scalingFactor, 1),
          protein: roundTo(ingredient.protein * scalingFactor, 1),
          fat: roundTo(ingredient.fat * scalingFactor, 1),
          carbs: roundTo(ingredient.carbs * scalingFactor, 1),
        };
      });

      const totalNutrition = ingredientDetails.reduce(
        (acc, curr) => {
          acc.calories = roundTo(acc.calories + curr.calories, 1);
          acc.protein = roundTo(acc.protein + curr.protein, 1);
          acc.fat = roundTo(acc.fat + curr.fat, 1);
          acc.carbs = roundTo(acc.carbs + curr.carbs, 1);
          return acc;
        },
        { calories: 0, protein: 0, fat: 0, carbs: 0 },
      );

      return {
        user: userId,
        title: meal.title,
        description: meal.description,
        category,
        preferences,
        restrictions,
        ingredients: ingredientDetails,
        nutrition: totalNutrition,
        archived: false,
      };
    });

    // Insert meals into the database
    for (const meal of meals) {
      await Meal.create(meal); // Insert one meal at a time
      console.log(`Inserted meal: ${meal.title}`);
      await delay(200); // 500ms delay between each meal insertion
    }

    console.log("Meals have been successfully added!");
  } catch (error) {
    console.error("Error inserting ingredients: ", error);
  } finally {
    mongoose.disconnect(); // Disconnect from the database
  }
};

seedMultiple();
