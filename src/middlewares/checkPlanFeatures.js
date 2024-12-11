const Ingredient = require("../models/Ingredient");
const Meal = require("../models/Meal");
const Plans = require("../models/Plans"); // Import Plan model
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
          const userIngredients = await Ingredient.find({
            user: user._id,
          });
          if (userIngredients && userIngredients.length > 0) {
            currentCount = userIngredients.filter((i) => !i.archived).length;
          }
          break;

        case "meals":
          const meals = await Meal.find({ user: user._id });
          if (meals) {
            currentCount = meals.filter((m) => !m.archived).length;
          }
          break;

        case "clients":
          // Replace with your Client model logic
          currentCount = await Client.countDocuments({ userId: user._id });
          break;

        case "meal_per_week":
          console.log("meal_per_week");
          break;

        default:
          return next(new AppError("Invalid resource type.", 400));
      }

      // Fetch the limit for the specified feature
      const userLimit = userPlan.features[featureKey];
      console.log("userLimit:", userLimit);

      // Handle "unlimited" case (-1)
      if (userLimit !== -1 && currentCount >= userLimit) {
        console.log("userLimit:", userLimit, "currentCount:", currentCount);
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
        console.log("Warning message");
        console.log("userLimit:", userLimit, "currentCount:", currentCount);

        req.warning = req.t(`featuresMessages.${featureKey}_warning`, {
          userLimit,
          userPlanName,
          remaining: userLimit - currentCount - 1,
        });
      }

      next(); // Allow request to proceed if all checks pass
    } catch (err) {
      next(err); // Forward errors to the global error handler
    }
  };
};

module.exports = checkPlanFeatures;
