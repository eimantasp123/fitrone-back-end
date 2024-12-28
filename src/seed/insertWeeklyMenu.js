const mongoose = require("mongoose");
const connectDB = require("../config/dbConfig");
const WeeklyMenu = require("../models/WeeklyMenu");

const menuData = [
  {
    title: "balanced week menu 1",
    description: "a weekly menu designed for balance and variety in meals",
    restrictions: ["glutenFree", "dairyFree"],
  },
  {
    title: "healthy choices menu 2",
    description: "focuses on nutritious meals to support a healthy lifestyle",
    status: "active",
    restrictions: ["glutenFree", "dairyFree"],
  },
  {
    title: "vegetarian vibes menu",
    description: "crafted for a vegetarian-friendly week",
    restrictions: ["glutenFree", "dairyFree"],
  },
  {
    title: "protein-packed menu",
    description:
      "great for fitness enthusiasts looking to up their protein intake",
    status: "active",
    preferences: ["vegetarian", "vegan"],
    restrictions: ["glutenFree", "dairyFree"],
  },
  {
    title: "low-carb menu",
    description: "ideal for those following a low-carb diet",
    status: "active",
    preferences: ["vegetarian", "vegan"],
    restrictions: ["glutenFree", "dairyFree"],
  },
  {
    title: "sweet and spicy menu",
    description: "a perfect balance of sweetness and spice",
  },
  {
    title: "mediterranean delights menu",
    description: "inspired by the Mediterranean diet",
  },
  {
    title: "plant-based menu",
    description: "perfect for a plant-based lifestyle",
    status: "active",
  },
  {
    title: "family-friendly menu",
    description: "meals the whole family will love",
  },
  { title: "quick and easy menu", description: "perfect for busy weeks" },
  {
    title: "gourmet week menu",
    description: "for the foodies who love gourmet meals",
  },
  {
    title: "comfort food menu",
    description: "indulge in classic comfort foods",
  },
  {
    title: "keto-friendly menu",
    description: "tailored for those on a keto diet",
    status: "active",
    preferences: ["vegetarian", "vegan"],
  },
  {
    title: "flexitarian menu",
    description: "balanced meals with a mix of plant and animal proteins",
    status: "active",
  },
  {
    title: "high-protein vegetarian menu",
    description: "a vegetarian menu with a protein boost",
    preferences: ["vegetarian", "vegan"],
  },
  {
    title: "pescatarian week menu",
    description: "perfect for a pescatarian lifestyle",
    status: "active",
    preferences: ["vegetarian", "vegan"],
  },
  {
    title: "spicy week menu",
    description: "for those who love their meals with a kick",
  },
  {
    title: "glutenFree menu",
    description: "great for those watching their sodium intake",
    preferences: ["vegetarian", "vegan"],
  },
  {
    title: "sugar-free week menu",
    description: "ideal for those reducing sugar intake",
  },
  {
    title: "budget-friendly menu",
    description: "delicious meals that are easy on your wallet",
    status: "active",
  },
  {
    title: "seasonal flavors menu",
    description: "features ingredients that highlight the season",
    preferences: ["vegetarian", "vegan"],
  },
  {
    title: "kids-approved menu",
    description: "simple and fun meals your kids will enjoy",
  },
  {
    title: "world cuisine menu",
    description: "explore tastes from around the globe",
  },
  {
    title: "high-energy menu",
    description: "meals designed to fuel your active lifestyle",
    status: "active",
    preferences: ["vegetarian", "vegan"],
  },
  {
    title: "detox week menu",
    description: "light meals to cleanse and refresh",
    preferences: ["vegetarian", "vegan"],
  },
  {
    title: "weekend feast menu",
    description: "indulge in hearty meals for the weekend",
    archived: true,
    preferences: ["vegetarian", "vegan"],
  },
  {
    title: "workday lunch menu",
    description: "quick and satisfying lunches for busy workdays",
    archived: true,
  },
  {
    title: "chef's special menu",
    description: "unique recipes curated by professional chefs",
    archived: true,
    preferences: ["vegetarian", "vegan"],
    restrictions: ["glutenFree", "dairyFree"],
  },
  {
    title: "vegetable lovers menu",
    description: "celebrating a variety of fresh vegetables",
    archived: true,
  },
  {
    title: "fruit-forward menu",
    description: "meals and desserts with a fruity twist",
    archived: true,
  },
  {
    title: "slow-cooker menu",
    description: "easy slow-cooked meals for busy days",
    archived: true,
    preferences: ["vegetarian", "vegan"],
  },
  {
    title: "one-pot wonders menu",
    description: "delicious meals made in just one pot",
    archived: true,
  },
  {
    title: "fusion flavors menu",
    description: "a creative mix of different culinary traditions",
    archived: true,
    restrictions: ["glutenFree", "dairyFree"],
  },
  {
    title: "sustainable cooking menu",
    description: "eco-friendly meals using sustainable ingredients",
    archived: true,
    restrictions: ["glutenFree", "dairyFree"],
  },
  {
    title: "meal-prep menu",
    description: "meals designed for easy prepping ahead of time",
    archived: true,
  },
  {
    title: "quick breakfast menu",
    description: "easy and healthy breakfast options",
    archived: true,
  },
  {
    title: "celebration menu",
    description: "festive meals for special occasions",
    archived: true,
  },
  {
    title: "fitness-focused menu",
    description: "perfect for staying on track with your fitness goals",
    archived: true,
  },
  {
    title: "heart-healthy menu",
    description: "meals crafted to promote heart health",
    archived: true,
  },
];

// Seed ingredients into the database
const seedWeeklyMenu = async () => {
  try {
    await connectDB(); // Connect to the database

    const userId = "674f3d2abd2012ba7e4a7f01"; // The user's IDv

    // Delete existing weekly menus for the user
    await WeeklyMenu.deleteMany({ user: userId });
    console.log(`Existing weekly menus for user ${userId} have been deleted.`);

    // Create an array of 7 days
    const defaultDays = Array.from({ length: 7 }, (_, i) => ({
      day: i,
      meals: [],
    }));

    // Delay function to pause execution for a specified time
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Map over menuData and insert each weekly menu with a 2-second delay
    for (const menu of menuData) {
      const weeklyMenu = {
        user: userId,
        title: menu.title,
        description: menu.description,
        archived: menu.archived ?? false,
        status: menu.status ?? "inactive",
        preferences: menu.preferences ?? [],
        restrictions: menu.restrictions ?? [],
        days: defaultDays,
      };

      // Insert the menu into the database
      await WeeklyMenu.create(weeklyMenu);
      console.log(`Inserted weekly menu: ${menu.title}`);

      // Wait for 2 seconds before processing the next menu
      await delay(200);
    }

    console.log("Weekly menus have been successfully added!");
  } catch (error) {
    console.error("Error inserting weekly menus: ", error);
  } finally {
    mongoose.disconnect(); // Disconnect from the database
  }
};

seedWeeklyMenu();
