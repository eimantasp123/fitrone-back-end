const { z } = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const OpenAI = require("openai");
const DietPlan = require("../models/DietPlan");
const User = require("../models/User");

const openai = new OpenAI();

const NutritionalInfo = z.object({
  kcal: z.number(),
  carbs: z.number(),
  fat: z.number(),
  protein: z.number(),
});

const Ingredient = z.object({
  name: z.string(),
  grams: z.number(),
  nutrition: NutritionalInfo,
});

const Meal = z.object({
  name: z.string(),
  time: z.string(),
  ingredients: z.array(Ingredient),
  nutrition: NutritionalInfo,
  cookingInstructions: z.string(),
  preparationInstructions: z.string(),
});

const Day = z.object({
  dayName: z.string(),
  meals: z.array(Meal),
});

const WeeklyMealPlan = z.object({
  days: z.array(Day),
  mealRepetitionPreference: z.string(),
});

// Generate a meal plan based on user input
exports.mealPlanGenerate = catchAsync(async (req, res, next) => {
  //
  const user = req.body;
  const prompt = `
      Create a weekly diet plan for a ${user.age} old ${user.gender} with the following details:
      - Height: ${user.height}
      - Weight: ${user.weight}
      ${user.weightGoals ? `- Fitness Goal: ${user.fitnessGoal} (current weight: ${user.weight}, goal weight: ${user.weightGoals})` : `- Fitness Goal: ${user.fitnessGoal}`}
      ${user.dietaryPreferences ? `- Dietary Preferences: ${user.dietaryPreferences}` : ""}
      ${user.dietaryRestrictions ? `- Dietary Restrictions: ${user.dietaryRestrictions}` : ""}
      ${user.foodAllergies ? `- Food Allergies: ${user.foodAllergies}` : ""}
      ${user.mealPerDay ? `- Meals per day: ${user.mealsPerDay}` : ""}
      ${user.snacksPerDay ? `- Snacks per day: ${user.snacksPerDay}` : ""}
      ${user.portionSize ? `- Portion Size: ${user.portionSize}` : ""}
      ${user.physicalActivityLevel ? `- Physical Activity Level: ${user.physicalActivityLevel}` : ""}
      ${user.occupation ? `- Occupation: ${user.occupation}` : ""}
      ${user.medicalConditions ? `- Medical Conditions: ${user.medicalConditions}` : ""}
      ${user.medications ? `- Medications: ${user.medications}` : ""}
      ${user.sleepPatterns ? `- Sleep Patterns: ${user.sleepPatterns}` : ""}
      ${user.stressLevels ? `- Stress Levels: ${user.stressLevels}` : ""}
      ${user.mealPrepAbility ? `- Meal Prep Ability: ${user.mealPrepAbility}` : ""}
      ${user.mealPrepTime ? `- Meal Prep Time: ${user.mealPrepTime}` : ""}
      ${user.foodBudget ? `- Budget: ${user.foodBudget}` : ""}
      ${user.favoriteFoods ? `- Favorite Foods: ${user.favoriteFoods}` : ""}
      ${user.foodsToAvoid ? `- Foods To Avoid: ${user.foodsToAvoid}` : ""}
      ${user.hydration ? `- Hydration: ${user.hydration}` : ""}
      ${user.alcoholConsumption ? `- Alcohol consumption: ${user.alcoholConsumption}` : ""}
      ${user.smoking ? `- Smoking habits: ${user.smoking}` : ""}
      ${user.mealRepetitionPreference ? `- Repeat Meals For Week: ${user.mealRepetitionPreference}` : ""}
      
      Requirements:
      - Language: English
      - Develop a comprehensive and nutritionally balanced meal plan tailored to the user's dietary needs, preferences, and budget.
      - Ensure recipes are crafted by certified nutritionists or culinary experts, with clear, step-by-step instructions for preparation.
      - Meals should be beginner-friendly, while incorporating professional techniques to enhance nutritional value and taste.
      - Prioritize the user's fitness goal of ${user.fitnessGoal}, accounting for their current physical activity level and overall lifestyle.
      - Consider portion control, macronutrient distribution, and nutritional adequacy to meet long-term health goals.
    
    `
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n");

  console.log(prompt);
  //   const response = await openai.beta.chat.completions.parse({
  //     model: "gpt-4o-2024-08-06",
  //     messages: [
  //       {
  //         role: "system",
  //         content:
  //           "You are a professional diet plan generator. Based on the user's input, you generate a personalized diet plan that considers the user's health goals, dietary preferences, activity level, and other relevant details. You should provide the diet plan directly based on the user's prompt.",
  //       },
  //       { role: "user", content: `${prompt}` },
  //     ],
  //     temperature: 0.7,
  //     response_format: zodResponseFormat(WeeklyMealPlan, "meal_plan"),
  //   });

  //   console.log(response.choices[0].message.parsed);

  //   if (response) {
  //     console.log(response.data.choices[0].text);
  //     console.log(response);
  //   }

  //   res.status(200).json({
  //     status: "success",
  //     message: response.choices[0].message.parsed,
  //   });
  res.status(200).json({
    status: "success",
    message: "done",
  });
});

// Create a meal plan for pending status
exports.mealPlanCreate = catchAsync(async (req, res, next) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new AppError("Please provide a valid meal plan", 400));
  }
  console.log(req.body);

  // Check if the user already has a pending meal plan
  const existingPlan = await DietPlan.findOne({ client: req.user.id });
  if (existingPlan) {
    return next(
      new AppError(
        "You already have a pending meal plan. Please wait for it to be approved or rejected.",
        400,
      ),
    );
  }

  // Find a trainer to assign the meal plan
  const trainer = await User.findOne({ role: "trainer" });
  if (!trainer) {
    return next(new AppError("No trainer found", 404));
  }
  // Create a new meal plan
  const mealPlan = await DietPlan.create({
    client: req.user.id,
    plan: req.body,
    trainer: trainer.id,
  });
  // Save the new meal plan and send response
  await mealPlan.save();

  const filteredMealPlan = {
    status: mealPlan.status,
    plan: mealPlan.plan,
    createdAt: mealPlan.createdAt,
  };

  res.status(201).json({
    status: "success",
    message: "Your meal plan has been submitted successfully!",
    data: {
      mealPlan: filteredMealPlan,
    },
  });
});

// Get a meal plan
exports.mealPlanGet = catchAsync(async (req, res, next) => {
  const mealPlan = await DietPlan.findOne({ client: req.user.id }).select(
    "status plan createdAt",
  );
  if (!mealPlan) {
    res.status(200).json({
      status: "success",
      data: {
        mealPlan: {
          status: "none",
        },
      },
    });
  } else {
    // Send response
    res.status(200).json({
      status: "success",
      data: {
        mealPlan,
      },
    });
  }
});

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
