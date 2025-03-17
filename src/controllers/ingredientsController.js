const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const openai = require("openai");
const z = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
const { default: mongoose } = require("mongoose");
const Ingredient = require("../models/Ingredient");
const UpdateService = require("../utils/updateService");
const { roundTo } = require("../helper/roundeNumber");

/**
 * OpenAI API key
 */
const openAi = new openai(process.env.OPENAI_API_KEY);

/**
 * Nutrition information schema
 */
const nutritionSchema = z.object({
  title: z.string(),
  unit: z.string(),
  amount: z.number(),
  calories: z.number(),
  protein: z.number(),
  fat: z.number(),
  carbs: z.number(),
});

/**
 * Get ingredient information from the FatSecret API
 */
exports.getIngredientInfo = catchAsync(async (req, res, next) => {
  let { query, unit } = req.body;

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
          "Please provide the nutrition information for the given ingredient. Response should include the title of the ingredient, unit, amount, calories, protein, fat, and carbs. Title should be the same as the input ingredient just with the first letter capitalized, grammar corrected in provided language. If this ingredient do not exist, please provide empty values for all fields.",
      },
      {
        role: "user",
        content: `
            ingredient: ${query}
            unit: ${unit}
            amount: 100
            language: ${req.language}
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
      title: response.title,
      amount: response.amount,
      unit: response.unit,
      calories: response.calories,
      protein: response.protein,
      fat: response.fat,
      carbs: response.carbs,
    },
  });
});

/**
 * Add a new ingredient to the user ingredient document
 */
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

  // Validate input
  if (!title || !unit) {
    return next(new AppError(req.t("meals:error.missingRequiredFields"), 400));
  }

  // List of numeric fields to validate
  const numericFields = { amount, calories, protein, fat, carbs };

  // Check if any field is missing or less than 0
  for (const value of Object.entries(numericFields)) {
    if (value === undefined || value === null || value < 0) {
      return next(
        new AppError(req.t("meals:error.missingRequiredFields")),
        400,
      );
    }
  }

  // Check if the ingredient already exists in the user ingredient document
  const ingredients = await Ingredient.find(
    {
      user: req.user._id,
      title: title.toLowerCase(),
      deletedAt: null,
    },
    {
      _id: 1,
      title: 1,
    },
  );

  const ingredientMatches = ingredients.filter(
    (ingredient) => ingredient.title === title.toLowerCase(),
  );

  if (ingredientMatches.length > 0) {
    return next(new AppError(req.t("meals:error.ingredientExists"), 400));
  }

  // Create a new ingredient
  const newIngredient = await Ingredient.create({
    user: req.user._id,
    title, // Assuming titles in both languages are the same
    unit,
    amount,
    calories: roundTo(calories, 1),
    protein: roundTo(protein, 1),
    carbs: roundTo(carbs, 1),
    fat: roundTo(fat, 1),
  });

  // Calculate the nutrition info based on the current amount
  let nutritionInfo = null;
  if (withCurrentAmount && currentAmount) {
    const scalingFactor = currentAmount / amount;
    nutritionInfo = {
      ingredientId: newIngredient._id,
      title: newIngredient.title,
      currentAmount: roundTo(currentAmount, 1),
      unit: newIngredient.unit,
      calories: roundTo(newIngredient.calories * scalingFactor, 1),
      protein: roundTo(newIngredient.protein * scalingFactor, 1),
      fat: roundTo(newIngredient.fat * scalingFactor, 1),
      carbs: roundTo(newIngredient.carbs * scalingFactor, 1),
    };
  } else {
    nutritionInfo = {
      ingredientId: newIngredient._id,
      title: newIngredient.title,
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

/**
 * Get all ingredients for the user
 */
exports.getIngredients = catchAsync(async (req, res, next) => {
  const { query } = req.query;

  // Define the query object
  const dbQuery = {
    user: req.user._id,
    archived: false,
    deletedAt: null,
  };

  // Check if the query parameter is provided
  if (query && query.length > 0) {
    dbQuery.title = new RegExp("^" + query.toLowerCase(), "i");
  }

  // page and limit
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // Get the ingredients and the total count
  const [ingredients, total] = await Promise.all([
    Ingredient.find(dbQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),

    Ingredient.countDocuments({
      user: req.user._id,
      archived: false,
      deletedAt: null,
    }),
  ]);

  const response = ingredients.map((ingredient) => ({
    ingredientId: ingredient._id,
    title: ingredient.title,
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
    total,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    data: response,
  });
});

/**
 * Delete ingredient from the user ingredient document
 */
exports.deleteIngredient = catchAsync(async (req, res, next) => {
  const { ingredientId } = req.params;

  // Check if the ingredient ID is valid
  if (!ingredientId || !mongoose.isValidObjectId(ingredientId)) {
    return next(new AppError(req.t("meals:error.invalidIngredientId"), 400));
  }

  // Find and delete the ingredient
  const ingredient = await Ingredient.findOne({
    _id: ingredientId,
    user: req.user._id,
  });

  if (!ingredient) {
    return next(new AppError(req.t("meals:error.ingredientNotFound"), 404));
  }

  // Soft delete the ingredient
  ingredient.deletedAt = new Date();
  await ingredient.save();

  return res.status(200).json({
    status: "success",
    message: req.t("meals:ingredientDeletedSuccessfully"),
  });
});

/**
 * Update ingredient in the user ingredient document
 */
exports.updateIngredient = catchAsync(async (req, res, next) => {
  const { ingredientId } = req.params;
  const { title, unit, calories, protein, carbs, amount, fat } = req.body;

  // Check if the id parameter is provided
  if (!ingredientId || !mongoose.isValidObjectId(ingredientId)) {
    return next(new AppError(req.t("meals:error.ingredientIdRequired"), 400));
  }

  // Standardize the title
  const standardizedTitle = title.trim().toLowerCase();

  // Check if the ingredient exists
  const titleExists = await Ingredient.exists({
    user: req.user._id,
    title: standardizedTitle,
    _id: { $ne: ingredientId },
    deletedAt: null,
  });

  if (titleExists) {
    return next(new AppError(req.t("meals:error.ingredientExists"), 400));
  }

  // Define updates
  const updates = {
    title: standardizedTitle, // Assuming bilingual titles
    unit,
    calories: roundTo(calories, 1),
    protein: roundTo(protein, 1),
    carbs: roundTo(carbs, 1),
    amount: roundTo(amount, 1),
    fat: roundTo(fat, 1),
  };

  // Use the UpdateService to handle the ingredient update and cascading logic
  await UpdateService.updateIngredient(ingredientId, updates, req, next);

  // Send the response
  res.status(200).json({
    status: "success",
    message: req.t("meals:ingredientUpdatedSuccessfully"),
  });
});

/**
 *  Search for ingredients in the user ingredient document
 */
exports.getIngredientSearch = catchAsync(async (req, res, next) => {
  const query = req.query.query;

  // Check if the query parameter is provided
  if (!query) {
    return next(new AppError(req.t("meals:error.queryRequired"), 400));
  }

  // Create a regex search query
  const searchQuery = new RegExp("^" + query.trim().toLowerCase(), "i");

  // Query the `Ingredient` collection for matching titles
  const ingredients = await Ingredient.find({
    user: req.user._id,
    title: searchQuery,
    archived: false,
    deletedAt: null,
  });

  // Map the results to the desired format
  const results = ingredients.map((ingredient) => ({
    ingredientId: ingredient._id,
    title: ingredient.title,
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

/**
 * Get ingredient nutrition info by ID from the user ingredient document and calculate the nutrition info based on the current amount
 */
exports.getIngredientNutrition = catchAsync(async (req, res, next) => {
  const { ingredientId } = req.params;
  const { currentAmount } = req.query;

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
    title: ingredient.title,
    currentAmount: Number(currentAmount),
    unit: ingredient.unit,
    calories: roundTo(ingredient.calories * scalingFactor, 1),
    protein: roundTo(ingredient.protein * scalingFactor, 1),
    fat: roundTo(ingredient.fat * scalingFactor, 1),
    carbs: roundTo(ingredient.carbs * scalingFactor, 1),
  };

  // Send the response
  res.status(200).json({
    status: "success",
    data: nutritionInfo,
  });
});
