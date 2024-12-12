const Meal = require("../models/Meal");
const WeekPlan = require("../models/WeekPlan");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const _ = require("lodash");

/**
 * Create a new week plan for the user
 */
exports.createWeekPlan = catchAsync(async (req, res, next) => {
  const { title, description, restrictions, preferences, startDate, endDate } =
    req.body;

  // Check if the required fields are provided
  if (!title || !startDate || !endDate) {
    return next(
      new AppError(
        req.t("weekPlanMessages.titleStartDateEndDateRequired"),
        400,
      ),
    );
  }

  // Get the week number and year for the start date
  const { weekNumber, year } = getWeekNumberAndYear(startDate);

  // Create an array of 7 days
  const days = Array.from({ length: 7 }, (_, i) => ({
    day: i,
    meals: [],
  }));

  // Create the week plan
  const weekPlan = await WeekPlan.create({
    user: req.user._id,
    title,
    description,
    restrictions,
    preferences,
    weekNumber,
    year,
    days,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });

  // Send response
  res.status(201).json({
    status: "success",
    message: req.t("weekPlanMessages.weekPlanCreated"),
    data: {
      weekPlan,
    },
  });
});

/**
 * Update a week plan by ID with new data
 */
exports.updateWeekPlan = catchAsync(async (req, res, next) => {
  const weekPlanId = req.params.weekPlanId;

  if (Object.keys(req.body).length === 0) {
    return next(new AppError(req.t("weekPlanMessages.noDataProvided"), 400));
  }

  // Pick only allowed fields from the request body
  const updates = _.pick(req.body, [
    "title",
    "description",
    "restrictions",
    "preferences",
    "startDate",
    "endDate",
  ]);

  // Validate startDate and endDate if provided
  if (
    updates.startDate &&
    updates.endDate &&
    updates.startDate > updates.endDate
  ) {
    return next(
      new AppError(req.t("weekPlanMessages.startDateMustBeBeforeEndDate"), 400),
    );
  }

  // Find the week plan
  const updatedWeekPlan = await WeekPlan.findOne({
    user: req.user._id,
    _id: weekPlanId,
  }).select("title description restrictions preferences startDate endDate");

  if (!updatedWeekPlan) {
    return next(new AppError(req.t("weekPlanMessages.weekPlanNotFound"), 404));
  }

  // Update the week plan
  Object.assign(updatedWeekPlan, updates);

  // Save the week plan
  await updatedWeekPlan.save();

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("weekPlanMessages.weekPlanUpdated"),
    data: {
      updatedWeekPlan,
    },
  });
});

/**
 * Delete a week plan by ID
 */
exports.deleteWeekPlan = catchAsync(async (req, res, next) => {
  const weekPlanId = req.params.weekPlanId;

  // Find the week plan
  const weekPlan = await WeekPlan.findOneAndDelete({
    user: req.user._id,
    _id: weekPlanId,
  });

  if (!weekPlan) {
    return next(new AppError(req.t("weekPlanMessages.weekPlanNotFound"), 404));
  }

  // Send response
  res.status(204).json({
    status: "success",
    message: req.t("weekPlanMessages.weekPlanDeleted"),
    data: null,
  });
});

// Add meal to a day in a current week plan
exports.addMealToDay = catchAsync(async (req, res, next) => {
  const { day, category, mealId, time } = req.body;
  const weekPlanId = req.params.weekPlanId;

  // Check if the required fields are provided
  if (day === undefined || day === null || !category || !mealId) {
    return next(
      new AppError(req.t("weekPlanMessages.dayCategoryAndMealIdRequired"), 400),
    );
  }

  // Check if the day is valid
  if (day < 0 || day > 6) {
    return next(new AppError("Invalid day", 400));
  }

  // Find the week plan
  const weekPlan = await WeekPlan.findOne({
    user: req.user._id,
    _id: weekPlanId,
  });

  if (!weekPlan) {
    return next(new AppError(req.t("weekPlanMessages.weekPlanNotFound"), 404));
  }

  // Check if the meal exists
  const meal = await Meal.findOne({
    user: req.user._id,
    _id: mealId,
  }).select("nutrition");

  if (!meal) {
    return next(new AppError(req.t("weekPlanMessages.mealNotFound"), 404));
  }

  // Add the meal to the specific day
  const targetDay = weekPlan.days.find((d) => d.day === day);
  if (!targetDay) {
    return next(
      new AppError(req.t("weekPlanMessages.invalidDayInWeekPlan"), 400),
    );
  }

  targetDay.meals.push({
    category,
    meal: mealId,
    time: time || null,
  });

  // Update nutrition values
  weekPlan.nutrition.calories = Number(
    weekPlan.nutrition.calories + meal.nutrition.calories,
  ).toFixed(1);
  weekPlan.nutrition.protein = Number(
    weekPlan.nutrition.protein + meal.nutrition.protein,
  ).toFixed(1);
  weekPlan.nutrition.fat = Number(
    weekPlan.nutrition.fat + meal.nutrition.fat,
  ).toFixed(1);
  weekPlan.nutrition.carbs = Number(
    weekPlan.nutrition.carbs + meal.nutrition.carbs,
  ).toFixed(1);

  // Save the week plan
  await weekPlan.save();

  // Fetch the updated week plan with populated meals
  const updatedWeekPlan = await WeekPlan.findOne({
    user: req.user._id,
    _id: weekPlanId,
  })
    .populate({
      path: "days.meals.meal",
      select: "title nutrition",
    })
    .lean();

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("weekPlanMessages.mealSuccessfullyAddedToTheWeekPlan"),
    data: {
      weekPlan: updatedWeekPlan,
    },
  });
});

/**
 * Delete a meal from a day in a current week plan
 */
exports.removeMealFromDay = catchAsync(async (req, res, next) => {
  const { weekPlanId } = req.params;
  const { arrayMealObjectId, mealId } = req.body;

  // Find the week plan
  const weekPlan = await WeekPlan.findOneAndUpdate(
    {
      user: req.user._id,
      _id: weekPlanId,
    },
    { $pull: { "days.$[].meals": { _id: arrayMealObjectId } } },
    { new: true },
  );

  // If the week plan is not found return an error
  if (!weekPlan) {
    return next(new AppError(req.t("weekPlanMessages.weekPlanNotFound"), 404));
  }

  const meal = await Meal.findOne({
    user: req.user._id,
    _id: mealId,
  }).select("nutrition");

  // Update the nutrition values
  weekPlan.nutrition = {
    calories: Number(
      weekPlan.nutrition.calories - meal.nutrition.calories,
    ).toFixed(1),
    protein: Number(
      weekPlan.nutrition.protein - meal.nutrition.protein,
    ).toFixed(1),
    fat: Number(weekPlan.nutrition.fat - meal.nutrition.fat).toFixed(1),
    carbs: Number(weekPlan.nutrition.carbs - meal.nutrition.carbs).toFixed(1),
  };

  // Save the week plan
  await weekPlan.save();

  // Fetch the updated week plan with populated meals
  const updatedWeekPlan = await WeekPlan.findOne({
    user: req.user._id,
    _id: weekPlanId,
  })
    .populate({
      path: "days.meals.meal",
      select: "title nutrition",
    })
    .lean();

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("weekPlanMessages.mealSuccessfullyRemovedFromTheWeekPlan"),
    data: {
      weekPlan: updatedWeekPlan,
    },
  });
});

/**
 * Get all week plans for the user
 */
exports.getWeekPlans = catchAsync(async (req, res, next) => {
  const weekPlans = await WeekPlan.find({ user: req.user._id }).populate({
    path: "days.meals.meal",
    select: "title nutrition",
  });

  res.status(200).json({
    status: "success",
    data: {
      weekPlans,
    },
  });
});

/**
 * Get a week number and year for a given date
 */
function getWeekNumberAndYear(date) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { weekNumber, year: d.getUTCFullYear() };
}
