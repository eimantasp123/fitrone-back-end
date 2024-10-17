const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { calculateDailyCaloriesIntake } = require("../utils/healthyHelper");
const MealPlanBalance = require("../models/MealPlanBalance");

// Get a meal plan balance
exports.mealPlanGet = catchAsync(async (req, res, next) => {
  const user = req.user;

  // Check if the user has a meal plan balance
  const mealPlan = await MealPlanBalance.findOne({ client: user.id });

  // If the user does not have a meal plan balance return a message and status as none
  if (!mealPlan) {
    return res.status(200).json({
      status: "success",
      data: {
        status: "none",
      },
    });
  }

  res.status(200).json({
    status: "success",
    data: {
      planBalance: mealPlan,
    },
  });
});

// Create a meal plan balance
exports.mealPlanBalance = catchAsync(async (req, res, next) => {
  // Check if the request body is empty
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new AppError("Please provide a valid meal plan", 400));
  }

  // Calculate daily calorie intake from the provided data
  const { kcal, carbs, fat, protein } = calculateDailyCaloriesIntake(req.body);

  // Check if the user already has a pending meal plan
  const existingPlan = await MealPlanBalance.findOne({ client: req.user.id });
  if (existingPlan) {
    return next(new AppError("You already have a meal plan balance. ", 400));
  }

  // Create a new meal plan balance
  const mealPlanBalance = await MealPlanBalance.create({
    ...req.body,
    nutritionInfo: {
      kcal,
      carbs,
      fat,
      protein,
    },
    client: req.user.id,
  });

  res.status(201).json({
    status: "success",
    message: "Your meal plan balance has been submitted successfully!",
    data: {
      planBalance: mealPlanBalance,
    },
  });
});

// Edit a meal plan balance
exports.updateMealPlanBalance = catchAsync(async (req, res, next) => {
  // Check if the request body is empty
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new AppError("Please provide a valid meal plan balance", 400));
  }

  // Calculate daily calorie intake from the provided data
  const { kcal, carbs, fat, protein } = calculateDailyCaloriesIntake(req.body);

  // Update the meal plan balance
  const mealPlanBalance = await MealPlanBalance.findOneAndUpdate(
    { client: req.user.id },
    {
      ...req.body,
      nutritionInfo: {
        kcal,
        carbs,
        fat,
        protein,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  // Check if the document was found and updated
  if (!mealPlanBalance) {
    return next(new AppError("You do not have a meal plan balance. ", 400));
  }

  res.status(201).json({
    status: "success",
    message: "Your meal plan balance has been updated successfully!",
    data: {
      planBalance: mealPlanBalance,
    },
  });
});
