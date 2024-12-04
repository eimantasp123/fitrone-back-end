const Plans = require("../models/Plans"); // Import Plan model
const UserIngredient = require("../models/UserIngredient"); // Example model for ingredients
const AppError = require("../utils/appError"); // Error handler

const checkPlanFeatures = (resourceType, featureKey) => {
  return async (req, res, next) => {
    try {
      const user = req.user; // Assuming user is added to `req` by a previous middleware (e.g., auth)
      const userPlanName = user.plan; // e.g., "Basic Plan", "Pro Plan", "Premium Plan"

      const userPlan = await Plans.findOne({ plan: userPlanName });
      if (!userPlan) {
        return next(new AppError("User plan not found.", 404));
      }

      // Get the user's current usage for the resource type (e.g., ingredients)
      let currentCount = 0;

      switch (resourceType) {
        case "ingredients":
          const userIngredients = await UserIngredient.findOne({
            user: user._id,
          });
          if (userIngredients) {
            currentCount = userIngredients.ingredients.length;
          }
          break;

        case "meals":
          // Replace with your Meal model logic
          currentCount = await Meal.countDocuments({ userId: user._id });
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

      // Handle "unlimited" case (-1)
      if (userLimit !== -1 && currentCount >= userLimit) {
        const featureName = featureKey.replace(/_/g, " ");
        return next(
          new AppError(
            req.t("errors.limit_reached", {
              featureName,
              userLimit,
              userPlanName,
            }),
            403,
          ),
        );
      }

      // Optionally warn users when they're close to their limit
      if (userLimit !== -1 && currentCount >= userLimit * 0.9) {
        req.warning = `You are nearing your ${featureKey.replace(
          /_/g,
          " ",
        )} limit (${currentCount}/${userLimit}) for your ${userPlanName}. Consider upgrading your plan.`;
      }

      next(); // Allow request to proceed if all checks pass
    } catch (err) {
      next(err); // Forward errors to the global error handler
    }
  };
};

module.exports = checkPlanFeatures;
