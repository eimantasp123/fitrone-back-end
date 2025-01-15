const Meal = require("../models/Meal");
const WeekPlan = require("../models/WeekPlan");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const _ = require("lodash");
const { inValidDate } = require("../utils/generalHelpers");
const { fromZonedTime } = require("date-fns-tz");

/**
 * Set user timezone
 */

//
exports.setUserTimezone = catchAsync(async (req, res, next) => {
  const { timezone } = req.body;
  // Check if timezone is provided
  if (!timezone) {
    return next(new AppError(req.t("validationErrors.timezoneRequired"), 400));
  }

  // Update user timezone
  req.user.timezone = timezone;
  await req.user.save();

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("weekPlan:messages.timezoneSetSuccess"),
    data: {
      timezone: req.user.timezone,
    },
  });
});

/**
 * Get week plan by date
 */
exports.getWeekPlanByDate = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.body;

  // 1. Check if date is provided and valid
  if (
    !inValidDate(startDate) ||
    !inValidDate(endDate) ||
    startDate >= endDate
  ) {
    return next(
      new AppError(
        req.t("weekPlan:validationErrors.startAndEndDateIsNotValid"),
        400,
      ),
    );
  }

  // 2. Find week plan for the user and date if not found and timezone is set, create a new week plan
  let weekPlan = await WeekPlan.find({
    user: req.user._id,
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  });

  console.log(weekPlan);
  console.log(req.user.timezone);

  // If week plan is not found and timezone is set, create a new week plan
  if (weekPlan.length === 0 && req.user.timezone) {
    console.log("Creating new week plan");
    weekPlan = await WeekPlan.create({
      user: req.user._id,
      startDate,
      endDate,
    });
  } else if (weekPlan.length === 0 && !req.user.timezone) {
    return res.status(200).json({
      status: "not_found",
      data: [],
    });
  }
  // 4. If week plan is found, return the week plan with populated data

  res.status(200).json({
    status: "success",
    data: weekPlan,
    timezone: req.user.timezone,
  });
});

/**
 * Create a new week plan for the user
 */
exports.createWeekPlan = catchAsync(async (req, res, next) => {
  const { startDate, endDate, assignMenu } = req.body;

  // Check if user has set timezone
  if (!req.user.timezone) {
    return next(new AppError(req.t("validationErrors.timezoneNotYetSet"), 400));
  }

  // Check if startDate and endDate are provided
  if (!startDate || !endDate) {
    return next(
      new AppError(req.t("validationErrors.startDateAndEndDateRequired"), 400),
    );
  }

  // Check if assignMenu is provided
  if (!Array.isArray(assignMenu) || assignMenu.length === 0) {
    return next(
      new AppError(req.t("validationErrors.assignMenuRequired"), 400),
    );
  }

  // Check if weekPlan already exists
  const weekPlan = await WeekPlan.findOne({
    user: req.user._id,
    startDate,
    endDate,
  });

  if (weekPlan) {
    return next(
      new AppError(req.t("validationErrors.weekPlanAlreadyExists"), 400),
    );
  }

  // Create initial week plan
  await WeekPlan.create({
    user: req.user._id,
    startDate,
    endDate,
    assignMenu: assignMenu.map((menuId) => {
      return {
        menu: menuId,
      };
    }),
  });

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("weekPlan:messages.weekPlanCreated"),
  });
});
