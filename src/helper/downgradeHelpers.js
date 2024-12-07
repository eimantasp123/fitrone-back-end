const UserIngredient = require("../models/UserIngredient");
const Plans = require("../models/Plans");
const mapPriceIdToPlan = require("../utils/generalHelpers");

//
//
// Downgrade the user plan functionality based on the plan features
//
//
exports.downgradePlanHandler = async (user, planId) => {
  try {
    console.log("Downgrading the user plan");
    // Extract the plans from the database
    const plans = await Plans.find();

    // Find the current and new plan
    const userPlan = plans.find((plan) => plan.plan === user.plan);
    const newPlan = plans.find(
      (plan) => plan.plan === mapPriceIdToPlan(planId),
    );

    // Ensure both plans exist
    if (!userPlan || !newPlan) {
      throw new Error("Current or new plan not found");
    }

    // Define the limits to compare
    const limits = ["ingredients_limit"];

    // Compare the limits and downgrade the user if necessary
    for (const limit of limits) {
      // Check if the limit is ingredients_limit
      if (limit === "ingredients_limit") {
        //
        // Find all the user ingredients
        const userIngredients = await UserIngredient.findOne({
          user: user._id,
        });

        // Check if the user has ingredients
        if (!userIngredients || !userIngredients.ingredients.length) {
          return user;
        }

        // Ingredients limit from plans
        const currentLimits = userPlan.features[limit] ?? 0;
        const newLimits = newPlan.features[limit];

        // Handle the case where the user has unlimited ingredients
        if (newLimits === -1) {
          // Unarchive all the ingredients
          await UserIngredient.updateOne(
            { user: user._id },
            { $set: { "ingredients.$[elem].archived": false } },
            { arrayFilters: [{ "elem.archived": true }] },
          );
          user.archivedData = null;
        } else if (currentLimits === -1 || currentLimits > newLimits) {
          const activeIngredients = userIngredients.ingredients.filter(
            (ingredient) => !ingredient.archived,
          );

          const archivedIngredients = userIngredients.ingredients.filter(
            (ingredient) => ingredient.archived,
          ).length;

          // Calculate the excess ingredients
          const excessIngredients = activeIngredients.length - newLimits;

          // Archive the excess ingredients
          if (excessIngredients > 0) {
            // Sort by oldest first
            const ingredientsToArchive = activeIngredients
              .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
              .slice(0, excessIngredients)
              .map((ingredient) => ingredient._id);

            // Archive the ingredients
            await UserIngredient.updateOne(
              { user: user._id },
              { $set: { "ingredients.$[elem].archived": true } },
              { arrayFilters: [{ "elem._id": { $in: ingredientsToArchive } }] },
            );
            user.archivedData.ingredients =
              excessIngredients + archivedIngredients;
            user.archivedData.messageRead = false;
          } else {
            user.archivedData = null;
          }
        } else if (newLimits > currentLimits) {
          // Upgrade: Unarchive ingredients up to the new limit
          const archivedIngredients = userIngredients.ingredients.filter(
            (ingredient) => ingredient.archived,
          );

          // Filter out the active ingredients
          const activeIngredients = userIngredients.ingredients.filter(
            (ingredient) => !ingredient.archived,
          );

          // Calculate the number of ingredients to unarchive to reach the new limit
          const unarchiveCount = newLimits - activeIngredients.length;

          if (unarchiveCount > 0) {
            const ingredientsToUnarchive = archivedIngredients
              .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
              .slice(0, unarchiveCount)
              .map((ingredient) => ingredient._id);

            // Unarchive the ingredients
            await UserIngredient.updateOne(
              { user: user._id },
              { $set: { "ingredients.$[elem].archived": false } },
              {
                arrayFilters: [{ "elem._id": { $in: ingredientsToUnarchive } }],
              },
            );
            user.archivedData.ingredients =
              archivedIngredients.length - unarchiveCount;
            user.archivedData.messageRead = false;
          } else {
            user.archivedData = null;
          }
        }
      }
    }

    return user;
  } catch (error) {
    console.error("Error in downgradePlanHandler:", error.message);
  }
};
