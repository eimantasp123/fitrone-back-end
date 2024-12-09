const UserIngredient = require("../models/UserIngredient");
const Plans = require("../models/Plans");
const mapPriceIdToPlan = require("../utils/generalHelpers");
const Meal = require("../models/Meal");

//
//
// Downgrade the user plan functionality based on the plan features
//
//
exports.downgradeOrUpgradePlanHandler = async (user, planId) => {
  try {
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
    const resourceConfigs = [
      {
        resourceType: "ingredients",
        model: UserIngredient,
        field: "ingredients",
        limitKey: "ingredients_limit",
        isNested: true,
      },
      {
        resourceType: "meals",
        model: Meal,
        field: null,
        limitKey: "meals_limit",
        isNested: false,
      },
    ];

    // Compare the limits and downgrade the user if necessary
    for (const config of resourceConfigs) {
      const { resourceType, model, field, limitKey, isNested } = config;

      // Ingredients limit from plans
      const currentLimits = userPlan.features[limitKey] ?? 0;
      const newLimits = newPlan.features[limitKey];

      // Handle unlimited case
      if (newLimits === -1) {
        await unarchiveAllResources(model, user._id, field, isNested);
        user.archivedData = null;
        continue;
      }

      // Fetch resources
      const { activeResources, archivedResources } = await getResources(
        model,
        user._id,
        field,
        isNested,
      );

      // Downgrade logic: Archive excess resources
      if (currentLimits === -1 || currentLimits > newLimits) {
        const excessResources = activeResources.length - newLimits;
        if (excessResources > 0) {
          const resourcesToArchive = getOldestResource(
            activeResources,
            excessResources,
          );

          await archiveResources(
            model,
            user._id,
            field,
            resourcesToArchive,
            isNested,
          );

          user.archivedData = {
            ...user.archivedData,
            [resourceType]:
              archivedResources.length + resourcesToArchive.length,
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

          await unarchiveResources(
            model,
            user._id,
            field,
            resourcesToUnarchive,
            isNested,
          );

          user.archivedData = {
            ...user.archivedData,
            [resourceType]: archivedResources.length - unarchiveCount,
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
async function getResources(model, userId, field, isNested) {
  if (isNested) {
    const userDoc = await model.findOne({ user: userId });
    const resources = userDoc?.[field] || [];
    return {
      activeResources: resources.filter((res) => !res.archived),
      archivedResources: resources.filter((res) => res.archived),
    };
  } else {
    const resources = await model.find({ user: userId });
    return {
      activeResources: resources.filter((res) => !res.archived),
      archivedResources: resources.filter((res) => res.archived),
    };
  }
}

/**
 * Archive specific resources
 */
async function archiveResources(model, userId, field, resourceIds, isNested) {
  if (isNested) {
    await model.updateOne(
      { user: userId },
      {
        $set: {
          [`${field}.$[elem].archived`]: true,
        },
      },
      {
        arrayFilters: [{ "elem._id": { $in: resourceIds } }],
      },
    );
  } else {
    await model.updateMany(
      { _id: { $in: resourceIds } },
      { $set: { archived: true } },
    );
  }
}

/**
 * Unarchive specified resources
 */
async function unarchiveResources(model, userId, field, resourceIds, isNested) {
  if (isNested) {
    await model.updateOne(
      { user: userId },
      { $set: { [`${field}.$[elem].archived`]: false } },
      { arrayFilters: [{ "elem._id": { $in: resourceIds } }] },
    );
  } else {
    await model.updateMany(
      { _id: { $in: resourceIds } },
      { $set: { archived: false } },
    );
  }
}

/**
 * Unarchive all resources
 */
async function unarchiveAllResources(model, userId, field, isNested) {
  if (isNested) {
    await model.updateOne(
      { user: userId },
      { $set: { [`${field}.$[elem].archived`]: false } },
      { arrayFilters: [{ "elem.archived": true }] },
    );
  } else {
    await model.updateMany(
      { user: userId, archived: true },
      { $set: { archived: false } },
    );
  }
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
