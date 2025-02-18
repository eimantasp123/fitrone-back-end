const Plans = require("../models/Plans"); // Import Plan model
const WeeklyPlan = require("../models/WeeklyPlan");
const AppError = require("../utils/appError"); // Error handler
const catchAsync = require("../utils/catchAsync");

// Middleware to check if the user has reached the limit for a specific feature
const checkWeeklyPlanMenu = catchAsync(async (req, res, next) => {
  const { id: weeklyPlanId } = req.params; // Get the week plan ID from the request params
  const { menus } = req.body; // Get the menus array from the request body
  const user = req.user; // Assuming user is attached to the request object
  const userPlanName = user.plan; // Get the user's current plan
  const featureKey = "weekly_plan_menu_limit"; // Feature key

  // Fetch the user's plan details
  const userPlan = await Plans.findOne({ plan: userPlanName });
  if (!userPlan) {
    return next(new AppError(req.t("plan_not_found"), 404));
  }

  // Fetch the limit for the specified feature
  const userLimit = userPlan.features[featureKey];

  // Find the current week plan
  const weeklyPlan = await WeeklyPlan.findOne({
    user: user._id,
    status: "active",
    _id: weeklyPlanId,
  });

  // If week plan is not found, return error
  if (!weeklyPlan) {
    return next(
      new AppError(
        req.t("weeklyPlan:validationErrors.weeklyPlanNotFound"),
        400,
      ),
    );
  }

  if (!menus || !Array.isArray(menus) || menus.length === 0) {
    return next(
      new AppError(req.t("weeklyPlan:validationErrors.menuRequired"), 400),
    );
  }

  // Get assigned week plan menus count
  const currentCount = weeklyPlan.assignMenu.length;

  // Filter out the menus that are already assigned to the week plan
  let pureMenus = menus.filter(
    (menu) => !weeklyPlan.assignMenu.some((m) => m.menu.equals(menu)),
  );

  // If all the menus are already assigned, return an error
  if (pureMenus.length === 0) {
    return res.status(400).json({
      status: "duplicate_menu",
      message: req.t("weeklyPlan:validationErrors.menuAlreadyAssigned"),
    });
  }

  if (userLimit !== -1) {
    const remainingSlots = userLimit - currentCount;

    // If the user has reached the limit, return an error
    if (remainingSlots <= 0) {
      return res.status(200).json({
        status: "limit_reached",
        message: req.t(`featuresMessages.${featureKey}`, {
          userLimit,
          userPlanName,
        }),
      });
    }

    // If the user is adding multiple menus and they exceed the limit
    if (pureMenus.length > remainingSlots) {
      pureMenus = pureMenus.slice(0, remainingSlots);
      req.warning_multiple = req.t(`featuresMessages.${featureKey}`, {
        userLimit,
        userPlanName,
      });
    }

    // Warn the user when they are 3 menus away from their limit
    if (remainingSlots - pureMenus.length <= 3) {
      req.warning = req.t(`featuresMessages.${featureKey}_warning`, {
        userLimit,
        userPlanName,
        remaining: remainingSlots - pureMenus.length,
      });
    }
  }

  req.body.menus = pureMenus;
  next();
});

module.exports = checkWeeklyPlanMenu;
