const WeekPlan = require("../models/WeekPlan.js");
const Customer = require("../models/Customer.js");
const User = require("../models/User.js");
const cron = require("node-cron");

// Cron Job - Runs Every Monday at 15:00 UTC
cron.schedule("0 15 * * 1", () => updateWeekPlanAndRemoveCustomersOrGroups());

// cron.schedule("*/5 * * * * *", async () =>
//   updateWeekPlanAndRemoveCustomersOrGroups(),
// );

const updateWeekPlanAndRemoveCustomersOrGroups = async () => {
  try {
    // Get all suppliers from the database
    const suppliers = await User.find({ role: "supplier" });

    if (!suppliers) {
      throw new Error("No suppliers found in the database");
    }

    // Loop through all suppliers and perform updates
    for (const supplier of suppliers) {
      // 1. Get all week plans for the supplier with status "expired" and isSnapshot "true"
      const weekPlans = await WeekPlan.find({
        user: supplier._id,
        status: "expired",
        isSnapshot: true,
      });

      // 2. Get all customers for the supplier
      const customers = await Customer.find({ supplier: supplier._id });

      // 3. Get all groups for the supplier

      // Convert to Sets for faster lookup
      const customerIds = new Set(customers.map((c) => c._id.toString()));

      // 4. Remove all customers from week plan if customer not found in supplier document
      for (const weekPlan of weekPlans) {
        for (const assignMenu of weekPlan.assignMenu) {
          // Remove all customers from week plan if customer not found in supplier document
          assignMenu.assignedClients = assignMenu.assignedClients.filter(
            (clientId) => customerIds.has(clientId.toString()),
          );
        }
        await weekPlan.save();
      }
    }

    console.log("Cleanup for weekPlan customers and group completed");
  } catch (error) {
    console.error(
      "Error during cleanup for weekPlan customers and group clenup:",
      error,
    );
  }
};
