const { seedWeeklyMenu } = require("./insertWeeklyMenu");
const { seedWeekPlans } = require("./insertWeekPlan");
const { seedMultipleData } = require("./insertMultipleData");

// Function to run all seed scripts
const runSeeds = async () => {
  try {
    console.log("Starting seed scripts...");

    // Run each seed script
    await seedMultipleData();
    console.log("Finished running insertMultipleData.js");

    await seedWeeklyMenu();
    console.log("Finished running insertIngredients.js");

    await seedWeekPlans();
    console.log("Finished running insertWeeklyMenu.js");

    console.log("All seed scripts executed successfully.");
  } catch (error) {
    console.error("Error executing seed scripts:", error);
  }
};

// Execute the function
runSeeds();
