const { getYear } = require("date-fns/getYear");
const Customer = require("../models/Customer");
const Ingredient = require("../models/Ingredient");
const Meal = require("../models/Meal");
const Plans = require("../models/Plans");
const WeeklyMenu = require("../models/WeeklyMenu");
const WeeklyPlan = require("../models/WeeklyPlan");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { formatInTimeZone } = require("date-fns-tz");
const { getWeek } = require("date-fns/getWeek");

/**
 * Get user limits based on plan
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} - User limits based on plan
 */
exports.getUserLimitsBasedOnPlan = catchAsync(async (req, res, next) => {
  // Get the current year and week number in UTC time
  const now = new Date();

  // Adjust the date to the user's timezone
  const zonedDate = formatInTimeZone(
    now,
    req.user.timezone ?? "UTC",
    "yyyy-MM-dd'T'HH:mm:ssXXX",
  );

  // Parse the zoned date string back to a Date object (to ensure timezone accuracy)
  const zonedDateObj = new Date(zonedDate);

  // Get the ISO week number (1-52/53, Monday as the first day of the week)
  const currentWeek = getWeek(zonedDateObj);

  // Get the year of the week
  const currentYear = getYear(zonedDateObj);

  // Get plan limits for the user
  const limits = await Plans.findOne({ plan: req.user.plan }).select(
    "-_id -__v -price -currency -key",
  );

  if (!limits) {
    return next(new AppError("Plan not found", 404));
  }

  // Get active ingredients count for the user
  const activeIngredients = await Ingredient.countDocuments({
    user: req.user.id,
    archived: false,
    deletedAt: null,
  });

  // Get active meals count for the user
  const activeMeals = await Meal.countDocuments({
    user: req.user.id,
    archived: false,
    deletedAt: null,
  });

  // Get active weekly menus count for the user
  const activeWeeklyMenus = await WeeklyMenu.countDocuments({
    user: req.user.id,
    archived: false,
    deletedAt: null,
  });

  // Get weekly plan menu limit for current week and count how many menus are assigned
  const weeklyPlan = await WeeklyPlan.findOne({
    user: req.user.id,
    weekNumber: currentWeek,
    year: currentYear,
  });

  // Get clients count for the user
  const clients = await Customer.countDocuments({
    supplier: req.user.id,
    deletedAt: null,
    status: { $ne: "inactive" },
  });

  res.status(200).json({
    status: "success",
    data: {
      plan: req.user.plan,
      usageLimits: {
        ingredients: {
          currentCount: activeIngredients || 0,
          limit: limits.features.ingredients_limit,
        },
        meals: {
          currentCount: activeMeals || 0,
          limit: limits.features.meals_limit,
        },
        weeklyMenus: {
          currentCount: activeWeeklyMenus || 0,
          limit: limits.features.weekly_menus_limit,
        },
        clients: {
          currentCount: clients || 0,
          limit: limits.features.clients_limit,
        },
        weeklyPlanMenus: {
          currentCount: weeklyPlan?.assignMenu.length || 0,
          limit: limits.features.weekly_plan_menu_limit,
        },
      },
      features: {
        aiSearch: limits.features.ai_search,
        clientRequestForm: limits.features.client_request_form,
      },
    },
  });
});
