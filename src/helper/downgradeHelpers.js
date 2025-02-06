const Plans = require("../models/Plans");
const Meal = require("../models/Meal");
const Ingredient = require("../models/Ingredient");
const { mapPriceIdToPlan } = require("../utils/generalHelpers");
const WeeklyMenu = require("../models/WeeklyMenu");

/**
 * Downgrade the user plan functionality based on the plan features
 *
 * @param {*} user  The user object
 * @param {*} planId  The plan ID
 * @returns
 *
 */
exports.downgradeOrUpgradePlanHandler = async (user, planId) => {
  try {
    // Extract the plans from the database
    const plans = await Plans.find();

    console.log("running downgradeOrUpgradePlanHandler");

    // Find the current and new plan
    const userPlan = plans.find((plan) => plan.plan === user.plan);
    const newPlan = plans.find(
      (plan) => plan.plan === mapPriceIdToPlan(planId),
    );

    console.log("userPlan", userPlan);
    console.log("newPlan", newPlan);

    // Ensure both plans exist
    if (!userPlan || !newPlan) {
      throw new Error("Current or new plan not found");
    }

    // Define the limits to compare
    const resourceConfigs = [
      {
        resourceType: "ingredients",
        model: Ingredient,
        limitKey: "ingredients_limit",
      },
      {
        resourceType: "meals",
        model: Meal,
        limitKey: "meals_limit",
      },
      {
        resourceType: "weeklyMenus",
        model: WeeklyMenu,
        limitKey: "weekly_menus_limit",
      },
    ];

    // Compare the limits and downgrade the user if necessary
    for (const config of resourceConfigs) {
      const { resourceType, model, limitKey } = config;

      // Ingredients limit from plans
      const currentLimits = userPlan.features[limitKey] ?? 0;
      const newLimits = newPlan.features[limitKey];

      // Handle unlimited case
      if (newLimits === -1) {
        await unarchiveAllResources(model, user._id);
        user.archivedData = null;
        continue;
      }

      // Fetch resources
      const { activeResources, archivedResources } = await getResources(
        model,
        user._id,
      );

      // Downgrade logic: Archive excess resources
      if (currentLimits === -1 || currentLimits > newLimits) {
        const excessResources = activeResources.length - newLimits;
        if (excessResources > 0) {
          const resourcesToArchive = getOldestResource(
            activeResources,
            excessResources,
          );

          await archiveResources(model, resourcesToArchive);

          const resourcesIsArchived =
            archivedResources.length + resourcesToArchive.length;
          user.archivedData = {
            ...user.archivedData,
            [resourceType]:
              resourcesIsArchived !== 0 ? resourcesIsArchived : null,
            messageRead: false,
          };
        } else {
          user.archivedData = null;
        }
        continue;
      }

      // Upgrade logic: Unarchive additional resources
      if (newLimits > currentLimits) {
        const unarchiveCount = Math.min(
          newLimits - activeResources.length,
          archivedResources.length,
        );

        if (unarchiveCount > 0) {
          const resourcesToUnarchive = getOldestResource(
            archivedResources,
            unarchiveCount,
          );

          await unarchiveResources(model, resourcesToUnarchive);

          const resourcesIsArchived = archivedResources.length - unarchiveCount;
          user.archivedData = {
            ...user.archivedData,
            [resourceType]:
              resourcesIsArchived !== 0 ? resourcesIsArchived : null,
            messageRead: false,
          };
        } else {
          user.archivedData = null;
        }
        continue;
      }
    }

    return user;
  } catch (error) {
    console.error("Error in downgradePlanHandler:", error.message);
    return user;
  }
};

/**
 *  Fetch active and archived resources
 */
async function getResources(model, userId) {
  const resources = await model.find({ user: userId });
  return {
    activeResources: resources.filter((res) => !res.archived),
    archivedResources: resources.filter((res) => res.archived),
  };
}

/**
 * Archive specific resources
 */
async function archiveResources(model, resourceIds) {
  await model.updateMany(
    { _id: { $in: resourceIds } },
    { $set: { archived: true } },
  );
}

/**
 * Unarchive specified resources
 */
async function unarchiveResources(model, resourceIds) {
  await model.updateMany(
    { _id: { $in: resourceIds } },
    { $set: { archived: false } },
  );
}

/**
 * Unarchive all resources
 */
async function unarchiveAllResources(model, userId) {
  await model.updateMany(
    { user: userId, archived: true },
    { $set: { archived: false } },
  );
}

/**
 * Get oldes resource by creation date
 */
function getOldestResource(resources, count) {
  return resources
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(0, count)
    .map((res) => res._id);
}
