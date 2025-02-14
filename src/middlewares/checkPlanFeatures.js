const Customer = require("../models/Customer");
const Group = require("../models/Group");
const Ingredient = require("../models/Ingredient");
const Meal = require("../models/Meal");
const Plans = require("../models/Plans"); // Import Plan model
const WeeklyMenu = require("../models/WeeklyMenu");
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

        case "customers":
          currentCount = await Customer.countDocuments({
            supplier: user._id,
            deletedAt: null,
          });
          break;

        case "weeklyMenus":
          currentCount = await getUserActiveResources(user._id, WeeklyMenu);
          break;

        case "groups":
          currentCount = await Group.countDocuments({ createdBy: user._id });
          break;

        default:
          return next(new AppError("Invalid resource type.", 400));
      }

      // Fetch the limit for the specified feature
      const userLimit = userPlan.features[featureKey];

      // Calculate the remaining slots
      const remainingSlots = userLimit - currentCount;

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
      if (userLimit !== -1 && remainingSlots - 1 <= 3) {
        req.warning = req.t(`featuresMessages.${featureKey}_warning`, {
          userLimit,
          userPlanName,
          remaining: remainingSlots - 1,
        });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
};

// Helper function to check the number of active resources for a user
const getUserActiveResources = async (userId, model) => {
  const data = await model.find({ user: userId, deletedAt: null });
  if (data && data.length > 0) {
    return data.filter((d) => !d.archived).length;
  } else {
    return 0;
  }
};

module.exports = checkPlanFeatures;
