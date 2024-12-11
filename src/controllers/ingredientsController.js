const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const openai = require("openai");
const z = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
const Meal = require("../models/Meal");
const { default: mongoose } = require("mongoose");
const Ingredient = require("../models/Ingredient");

//
//
// Auth for openAi
//
const openAi = new openai(process.env.OPENAI_API_KEY);

//
//
// Schema for the nutrition information
//
const nutritionSchema = z.object({
  title: z.object({
    lt: z.string(),
    en: z.string(),
  }),
  unit: z.string(),
  amount: z.number(),
  calories: z.number(),
  protein: z.number(),
  fat: z.number(),
  carbs: z.number(),
});

//
//
// Get ingredient information from FatSecret API
//
exports.getIngredientInfo = catchAsync(async (req, res, next) => {
  let { query, unit, amount } = req.body;

  // Get the language from the request object
  const lang = req.lng || "en";

  // Check if the query parameter is provided
  if (!query) {
    return next(new AppError(req.t("meals:error.queryRequired"), 400));
  }

  // Request to openai to get the nutrition information
  const completion = await openAi.beta.chat.completions.parse({
    model: "gpt-4o-2024-08-06",
    messages: [
      {
        role: "system",
        content:
          "Please provide the nutrition information for the given ingredient. Response should include the title of the ingredient, unit, amount, calories, protein, fat, and carbs. Title should be the same as the input ingredient just with the first letter capitalized, grammar corrected and in Lithuanian and English languages. If this ingredient do not exist, please provide empty values for all fields.",
      },
      {
        role: "user",
        content: `
            ingredient: ${query}
            unit: ${unit}
            amount: ${amount}
        `,
      },
    ],
    max_tokens: 1000,
    temperature: 0.7,
    response_format: zodResponseFormat(nutritionSchema, "nutrition"),
  });

  // Refactor the response object to get the nutrition information
  const response = completion.choices[0].message.parsed;

  // Send the response
  res.status(200).json({
    status: "success",
    data: {
      title: response.title[lang],
      amount: response.amount,
      unit: response.unit,
      calories: response.calories,
      protein: response.protein,
      fat: response.fat,
      carbs: response.carbs,
    },
  });
});

//
//
// Add ingredient to the user ingredient document
//
exports.addIngredient = catchAsync(async (req, res, next) => {
  const {
    title,
    unit,
    calories,
    protein,
    carbs,
    amount,
    fat,
    currentAmount,
    withCurrentAmount,
  } = req.body;

  // Get the language from the request object
  const lang = req.lng || "en";

  // Validate input
  if (!title || !unit || !amount || !calories || !protein || !fat || !carbs) {
    return next(new AppError(req.t("meals:error.missingRequiredFields"), 400));
  }

  // Check if the ingredient already exists in the user ingredient document
  const ingredients = await Ingredient.find({
    user: req.user._id,
    [`title.${lang}`]: title.toLowerCase(),
  });

  const ingredientMatches = ingredients.filter(
    (ingredient) => ingredient.title[lang] === title.toLowerCase(),
  );

  if (ingredientMatches.length > 0) {
    console.log(ingredientMatches);
    return next(new AppError(req.t("meals:error.ingredientExists"), 400));
  }
  // Create a new ingredient
  const newIngredient = await Ingredient.create({
    user: req.user._id,
    title: { en: title, lt: title }, // Assuming titles in both languages are the same
    unit,
    amount,
    calories,
    protein,
    carbs,
    fat,
  });

  // Calculate the nutrition info based on the current amount
  let nutritionInfo = null;
  if (withCurrentAmount && currentAmount) {
    const scalingFactor = currentAmount / amount;
    nutritionInfo = {
      ingredientId: newIngredient._id,
      title: newIngredient.title[lang],
      currentAmount: Number(currentAmount),
      unit: newIngredient.unit,
      calories: Number((newIngredient.calories * scalingFactor).toFixed(1)),
      protein: Number((newIngredient.protein * scalingFactor).toFixed(1)),
      fat: Number((newIngredient.fat * scalingFactor).toFixed(1)),
      carbs: Number((newIngredient.carbs * scalingFactor).toFixed(1)),
    };
  } else {
    nutritionInfo = {
      ingredientId: newIngredient._id,
      title: newIngredient.title[lang],
      unit: newIngredient.unit,
      amount: newIngredient.amount,
      calories: newIngredient.calories,
      protein: newIngredient.protein,
      fat: newIngredient.fat,
      carbs: newIngredient.carbs,
    };
  }

  // Response data
  const responseData = {
    status: "success",
    message: req.t("meals:ingredientAddedSuccesfuly"),
    data: nutritionInfo,
  };

  // Add warning to the response if it exists
  if (req.warning) {
    responseData.warning = req.warning;
  }

  // Send the response
  res.status(201).json(responseData);
});

//
//
// Get all ingredients for the user
//
exports.getIngredients = catchAsync(async (req, res, next) => {
  // Get the language from the request object
  const lang = req.lng || "en";

  // Query the `Ingredient` collection for the user's ingredients
  const ingredients = await Ingredient.find({
    user: req.user._id,
    archived: { $ne: true },
  }).sort({ createdAt: -1 });

  const response = ingredients.map((ingredient) => ({
    ingredientId: ingredient._id,
    title: ingredient.title[lang],
    unit: ingredient.unit,
    amount: ingredient.amount,
    calories: ingredient.calories,
    protein: ingredient.protein,
    fat: ingredient.fat,
    carbs: ingredient.carbs,
  }));

  // Send the response
  res.status(200).json({
    status: "success",
    results: response.length,
    data: response,
  });
});

//
//
// Delete ingredient from the user ingredient document
//
exports.deleteIngredient = catchAsync(async (req, res, next) => {
  const { ingredientId } = req.params;

  // Check if the id parameter is provided
  if (!ingredientId) {
    return next(new AppError(req.t("meals:error.ingredientIdRequired"), 400));
  }

  const ingredient = await Ingredient.findOneAndDelete({
    _id: ingredientId,
    user: req.user._id,
  });

  if (!ingredient) {
    return next(new AppError(req.t("meals:error.ingredientNotFound"), 404));
  }

  // Find all meals that used the deleted ingredient
  const mealsToUpdate = await Meal.find({
    user: req.user._id,
    "ingredients.ingredientId": ingredientId,
  });

  for (const meal of mealsToUpdate) {
    // Filter out the ingredient to delete
    meal.ingredients = meal.ingredients.filter(
      (ingredient) => ingredient.ingredientId.toString() !== ingredientId,
    );

    // Recalculate the total nutrition info for the meal
    meal.nutrition = meal.ingredients.reduce(
      (acc, curr) => {
        acc.calories = Number((acc.calories + curr.calories).toFixed(1));
        acc.protein = Number((acc.protein + curr.protein).toFixed(1));
        acc.fat = Number((acc.fat + curr.fat).toFixed(1));
        acc.carbs = Number((acc.carbs + curr.carbs).toFixed(1));
        return acc;
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0 },
    );

    // Save the updated meal
    await meal.save();
  }

  // Send the response
  res.status(200).json({
    status: "success",
    message: req.t("meals:ingredientDeletedSuccessfully"),
    data: {
      ingredient,
      mealsUpdated: mealsToUpdate.length,
    },
  });
});

//
//
// Update ingredient in the user ingredient document
//
exports.updateIngredient = catchAsync(async (req, res, next) => {
  const { ingredientId } = req.params;
  const { title, unit, calories, protein, carbs, amount, fat } = req.body;
  // Get the language from the request object
  const lang = req.lng || "en";

  // Check if the id parameter is provided
  if (!ingredientId) {
    return next(new AppError(req.t("meals:error.ingredientIdRequired"), 400));
  }

  // Check if the ingredient title already exists in the user ingredient document on other ingredient
  const ingredients = await Ingredient.find({
    user: req.user._id,
    [`title.${lang}`]: title.toLowerCase(),
    _id: { $ne: ingredientId },
  });

  const ingredientMatches = ingredients.filter(
    (ingredient) => ingredient.title[lang] === title.toLowerCase(),
  );

  if (ingredientMatches.length > 0) {
    return next(new AppError(req.t("meals:error.ingredientExists"), 400));
  }

  // Update the ingredient
  const ingredient = await Ingredient.findOneAndUpdate(
    { _id: ingredientId, user: req.user._id },
    {
      title: { en: title, lt: title },
      unit,
      calories,
      protein,
      carbs,
      amount,
      fat,
    },
    { new: true },
  );

  if (!ingredient) {
    return next(new AppError(req.t("meals:error.ingredientNotFound"), 404));
  }

  // Update meals that reference this ingredient
  const mealsToUpdate = await Meal.find({
    user: req.user._id,
    "ingredients.ingredientId": ingredientId,
  });

  for (const meal of mealsToUpdate) {
    meal.ingredients = meal.ingredients.map((mealIngredient) => {
      if (mealIngredient.ingredientId.toString() === ingredientId) {
        const scalingFactor = mealIngredient.currentAmount / amount;

        return {
          ...mealIngredient._doc,
          title: ingredient.title[lang],
          unit: ingredient.unit,
          calories: (ingredient.calories * scalingFactor).toFixed(1),
          protein: (ingredient.protein * scalingFactor).toFixed(1),
          fat: (ingredient.fat * scalingFactor).toFixed(1),
          carbs: (ingredient.carbs * scalingFactor).toFixed(1),
        };
      }
      return mealIngredient;
    });

    // Recalculate the nutrition info
    meal.nutrition = meal.ingredients.reduce(
      (acc, curr) => {
        acc.calories += curr.calories;
        acc.protein += curr.protein;
        acc.fat += curr.fat;
        acc.carbs += curr.carbs;
        return acc;
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0 },
    );

    await meal.save();
  }

  // Send the response
  res.status(200).json({
    status: "success",
    message: req.t("meals:ingredientUpdatedSuccessfully"),
    data: {
      ingredientId: ingredient._id,
      title: ingredient.title[lang],
      unit: ingredient.unit,
      amount: ingredient.amount,
      calories: ingredient.calories,
      protein: ingredient.protein,
      fat: ingredient.fat,
      carbs: ingredient.carbs,
    },
  });
});

//
//
// Search for ingredients in the user ingredient document
//
exports.getIngredientSearch = catchAsync(async (req, res, next) => {
  const query = req.query.query;
  const lang = req.lng || "en";

  // Check if the query parameter is provided
  if (!query) {
    return next(new AppError(req.t("meals:error.queryRequired"), 400));
  }

  // Escape the query to prevent regex injection
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escapedQuery, "i");

  // Query the `Ingredient` collection for matching titles
  const ingredients = await Ingredient.find({
    user: req.user._id,
    [`title.${lang}`]: { $regex: regex }, // Dynamically match language-specific title
    archived: { $ne: true },
  });

  // Map the results to the desired format
  const results = ingredients.map((ingredient) => ({
    ingredientId: ingredient._id,
    title: ingredient.title[lang],
    unit: ingredient.unit,
    amount: ingredient.amount,
    calories: ingredient.calories,
    protein: ingredient.protein,
    fat: ingredient.fat,
    carbs: ingredient.carbs,
  }));

  // Send the response
  res.status(200).json({
    status: "success",
    results: results.length,
    data: results,
  });
});

//
//
// Get ingredient by id from the user ingredient document and calculate the nutrition info based on the current amount
//
exports.getIngredientNutrition = catchAsync(async (req, res, next) => {
  const { ingredientId } = req.params;
  const { currentAmount } = req.query;

  // Get the language from the request object
  const lang = req.lng || "en";

  // Check if the id parameter is provided
  if (
    !ingredientId &&
    !mongoose.Types.ObjectId.isValid(ingredientId) &&
    !currentAmount
  ) {
    return next(
      new AppError(
        req.t("meals:error.ingredientIdAndCurrentAmountIsRequired"),
        400,
      ),
    );
  }

  // Query the `Ingredient` collection
  const ingredient = await Ingredient.findOne({
    _id: ingredientId,
    user: req.user._id,
  });

  // Check if the ingredient exists
  if (!ingredient) {
    return next(new AppError(req.t("meals:error.ingredientNotFound"), 404));
  }

  // Calculate the nutrition info based on the current amount
  const scalingFactor = currentAmount / ingredient.amount;
  const nutritionInfo = {
    ingredientId: ingredient._id,
    title: ingredient.title[lang],
    currentAmount: Number(currentAmount),
    unit: ingredient.unit,
    calories: Number((ingredient.calories * scalingFactor).toFixed(1)),
    protein: Number((ingredient.protein * scalingFactor).toFixed(1)),
    fat: Number((ingredient.fat * scalingFactor).toFixed(1)),
    carbs: Number((ingredient.carbs * scalingFactor).toFixed(1)),
  };

  // Send the response
  res.status(200).json({
    status: "success",
    data: nutritionInfo,
  });
});
