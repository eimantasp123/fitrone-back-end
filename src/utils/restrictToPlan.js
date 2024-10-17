// restrict user based on their subscription plan
exports.restrictToPlan =
  (...plans) =>
  (req, res, next) => {
    if (!plans.includes(req.user.plan)) {
      return next(
        new AppError(
          "You do not have permission to perform this action. Please upgrade your subscription plan.",
          403,
        ),
      );
    }
    next();
  };
