const { z } = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const OpenAI = require("openai");
const DietPlan = require("../models/DietPlan");
const User = require("../models/User");
const e = require("express");
const {
  calculateDailyCaloriesIntake,
  calculateMealMacronutrients,
} = require("../utils/healthyHelper");
const axios = require("axios");
const { items } = require("../controllers/mock/mealPlan");
const DietPlanBalance = require("../models/DietPlanBalance");

const openai = new OpenAI();

//
exports.mealPlanGet = catchAsync(async (req, res, next) => {
  const user = req.user;
  const mealPlan = await DietPlan.findOne({ client: user.id }).populate(
    "planBalance",
  );
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
    data: mealPlan,
  });
});

// Create a meal plan for pending status
exports.mealPlanBalance = catchAsync(async (req, res, next) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new AppError("Please provide a valid meal plan", 400));
  }

  // Calculate daily calories intake
  const { kcal, carbs, fat, protein } = calculateDailyCaloriesIntake(req.body);

  // Check if the user already has a pending meal plan
  const existingPlan = await DietPlan.findOne({ client: req.user.id });
  if (existingPlan) {
    return next(new AppError("You already have a meal plan. ", 400));
  }

  const dietPlanBalance = await DietPlanBalance.create({
    ...req.body,
    nutritionInfo: {
      kcal,
      carbs,
      fat,
      protein,
    },
    client: req.user.id,
  });

  const mealPlan = new DietPlan({
    client: req.user.id,
    planBalance: dietPlanBalance.id,
  });

  await mealPlan.save();

  const populatedMealPlan = {
    ...mealPlan.toObject(),
    planBalance: dietPlanBalance,
  };

  res.status(201).json({
    status: "success",
    message: "Your meal plan balance has been submitted successfully!",
    data: populatedMealPlan,
  });
});

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
