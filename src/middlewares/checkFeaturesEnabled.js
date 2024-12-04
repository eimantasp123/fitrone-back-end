const Plans = require("../models/Plans");
const AppError = require("../utils/appError");

const checkFeatureEnabled = (featureKey) => {
  return async (req, res, next) => {
    try {
      const user = req.user; // Assuming `user` is added to `req` by an auth middleware
      const userPlan = await Plans.findOne({ name: user.plan });

      if (!userPlan) {
        return next(new AppError("User plan not found.", 404));
      }

      const isFeatureEnabled = userPlan.features[featureKey];

      if (!isFeatureEnabled) {
        return next(
          new AppError(
            `The ${featureKey.replace(/_/g, " ")} feature is not available in your ${user.plan}. Upgrade your plan to access this feature.`,
            403,
          ),
        );
      }

      next(); // Proceed to the next middleware or route handler
    } catch (err) {
      next(err);
    }
  };
};

module.exports = checkFeatureEnabled;
