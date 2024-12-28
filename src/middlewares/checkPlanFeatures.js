const Ingredient = require("../models/Ingredient");
const Meal = require("../models/Meal");
const Plans = require("../models/Plans"); // Import Plan model
const WeeklyMenu = require("../models/WeeklyMenu");
const WeekPlan = require("../models/WeekPlan");
const AppError = require("../utils/appError"); // Error handler

// Middleware to check if the user has reached the limit for a specific feature
const checkPlanFeatures = (resourceType, featureKey) => {
  return async (req, res, next) => {
    try {
      const user = req.user; // Assuming user is attached to the request object
      const userPlanName = user.plan; // Get the user's current plan

      // Fetch the user's plan details
      const userPlan = await Plans.findOne({ plan: userPlanName });
      if (!userPlan) {
        return next(new AppError(req.t("plan_not_found"), 404));
      }

      // Get the user's current usage for the resource type (e.g., ingredients)
      let currentCount = 0;

      // Switch statement to handle different resource types
      switch (resourceType) {
        case "ingredients":
          currentCount = await getUserActiveResources(user._id, Ingredient);
          break;

        case "meals":
          currentCount = await getUserActiveResources(user._id, Meal);
          break;

        case "weeklyMenus":
          currentCount = await getUserActiveResources(user._id, WeeklyMenu);
          break;

        case "weekPlans":
          currentCount = await getUserActiveResources(user._id, WeekPlan);
          break;

        case "clients":
          // Replace with your Client model logic
          currentCount = await Client.countDocuments({ userId: user._id });
          break;

        default:
          return next(new AppError("Invalid resource type.", 400));
      }

      // Fetch the limit for the specified feature
      const userLimit = userPlan.features[featureKey];
      console.log("userLimit:", userLimit);

      // Handle "unlimited" case (-1)
      if (userLimit !== -1 && currentCount >= userLimit) {
        return res.status(200).json({
          status: "limit_reached",
          message: req.t(`featuresMessages.${featureKey}`, {
            userLimit,
            userPlanName,
          }),
        });
      }

      // Optionally warn users when they're close to their limit
      if (userLimit !== -1 && userLimit - (currentCount + 1) === 3) {
        console.log("Warning: User is close to the limit", userLimit);
        console.log("currentCount:", currentCount);

        req.warning = req.t(`featuresMessages.${featureKey}_warning`, {
          userLimit,
          userPlanName,
          remaining: userLimit - currentCount - 1,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

// Helper function to check the number of active resources for a user
const getUserActiveResources = async (userId, model) => {
  const data = await model.find({ user: userId });
  if (data && data.length > 0) {
    return data.filter((d) => !d.archived).length;
  } else {
    return 0;
  }
};

module.exports = checkPlanFeatures;
