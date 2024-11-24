const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const openai = require("openai");
const z = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
const UserIngredient = require("../models/UserIngredient");
const Meal = require("../models/Meal");
const { default: mongoose } = require("mongoose");

// auth for openai
const openAi = new openai(process.env.OPENAI_API_KEY);

// Schema for the nutrition information
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

  const response = completion.choices[0].message.parsed;
  // Send the response
  res.status(200).json({
    status: "success",
    data: {
      title: response.title[lang],
      unit: response.unit,
      amount: response.amount,
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
  const data = req.body;

  // Get the language from the request object
  const lang = req.lng || "en";

  // Create a new ingredient object
  const newIngredient = {
    title: {
      lt: data.title,
      en: data.title,
    },
    unit: data.unit,
    amount: data.amount,
    calories: data.calories,
    protein: data.protein,
    fat: data.fat,
    carbs: data.carbs,
  };

  // Check if user has the ingredient document
  let userIngredient = await UserIngredient.findOne({ user: req.user._id });

  // If user ingredient document does not exist, create a new one
  if (!userIngredient) {
    userIngredient = new UserIngredient({
      user: req.user._id,
      lang,
      ingredients: [newIngredient],
    });
  } else {
    // Check if the ingredient already exists in the user ingredient document
    const ingredientExists = userIngredient.ingredients.some(
      (ingredient) => ingredient.title[lang] === newIngredient.title[lang],
    );

    // If the ingredient already exists, send an error response
    if (ingredientExists) {
      return next(new AppError(req.t("meals:error.ingredientExists"), 400));
    }

    // Add the new ingredient to the existing document
    userIngredient.ingredients.push(newIngredient);
  }

  // Save the user ingredient document
  await userIngredient.save();

  // Send the response
  res.status(201).json({
    status: "success",
    message: req.t("meals:ingredientAddedSuccesfuly"),
  });
});

//
//
// Search for ingredients in the user ingredient document
//
exports.getIngredientSearch = catchAsync(async (req, res, next) => {
  const query = req.query.query;

  // Get the language from the request object
  const lang = req.lng || "en";

  // Check if the query parameter is provided
  if (!query) {
    return next(new AppError(req.t("meals:error.queryRequired"), 400));
  }

  // Escape the query to prevent regex injection
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escapedQuery, "i");

  // Query the database for ingredients matching the query in the specified language
  const userIngredients = await UserIngredient.find({
    user: req.user._id,
  });

  // Extract matching ingredients with only the current language title
  const results = userIngredients.flatMap((doc) =>
    doc.ingredients
      .filter((ingredient) => regex.test(ingredient.title[lang]))
      .map((ingredient) => ({
        _id: ingredient._id,
        title: ingredient.title[lang],
        unit: ingredient.unit,
        amount: ingredient.amount,
        calories: ingredient.calories,
        protein: ingredient.protein,
        fat: ingredient.fat,
        carbs: ingredient.carbs,
      })),
  );

  // Send the response
  res.status(200).json({
    status: "success",
    results: results.length,
    data: results,
  });
});

//
//
// Add meal to the user meal document
//
exports.addMeal = catchAsync(async (req, res, next) => {
  const data = req.body;

  // Ensure all necessary fields are provided
  if (!data.title || !data.ingredients || !data.nutrition) {
    return next(new AppError(req.t("meals:error.missingRequiredFields"), 400));
  }

  // Check if a meal with the same title already exists for this user
  const existingMeal = await Meal.findOne({
    user: req.user._id,
    title: data.title,
  });

  if (existingMeal) {
    return next(new AppError(req.t("meals:error.titleMustBeUnique"), 400));
  }

  // Build the meal object based on the request data
  const newMeal = {
    user: req.user._id,
    title: data.title,
    description: data.description || "",
    ingredients: data.ingredients,
    category: data.category || "",
    nutrition: {
      calories: data.nutrition.calories,
      protein: data.nutrition.protein,
      fat: data.nutrition.fat,
      carbs: data.nutrition.carbs,
    },
    preferences: data.preferences || [],
    restrictions: data.restrictions || [],
  };

  // Create and save the new meal document
  const meal = await Meal.create(newMeal);

  // Format response object
  const formattedMeal = meal.toObject();
  delete formattedMeal.user;
  delete formattedMeal.__v;
  delete formattedMeal.updatedAt;

  res.status(201).json({
    status: "success",
    message: req.t("meals:mealAddedSuccessfully"),
    data: formattedMeal,
  });
});

//
//
// Get all meals for the user
//
exports.getMeals = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, category, preference, restriction } = req.query;

  // Pagination options
  const skip = (page - 1) * limit;

  // Query the database for all meals for the user
  const query = { user: req.user._id };

  if (category) {
    query.category = category;
  }

  if (preference) {
    query.preferences = preference;
  }

  if (restriction) {
    query.restrictions = restriction;
  }

  // Get the total number of results
  const totalResults = await Meal.countDocuments(query);

  // Fetch filtered meals with pagination
  const meals = await Meal.find(query)
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 }); // Newest first

  // Format response object
  const formattedMeals = meals.map((meal) => {
    const formattedMeal = meal.toObject();
    delete formattedMeal.user;
    delete formattedMeal.__v;
    delete formattedMeal.updatedAt;
    return formattedMeal;
  });

  // Send the response
  res.status(200).json({
    status: "success",
    results: meals.length,
    totalResults,
    totalPages: Math.ceil(totalResults / limit),
    currentPage: parseInt(page),
    data: formattedMeals,
  });
});

//
//
// Delete meal for the user
//
exports.deleteMeal = catchAsync(async (req, res, next) => {
  const { mealId: id } = req.query;

  // Check if the id parameter is provided
  if (!id) {
    return next(new AppError(req.t("meals:error.idRequired"), 400));
  }

  // Query the database for the meal to delete
  const deletedMeal = await Meal.findOneAndDelete({
    user: req.user._id,
    _id: id,
  }).select("-user");

  // Check if the meal exists
  if (!deletedMeal) {
    return next(new AppError(req.t("meals:error.mealNotFound"), 404));
  }

  // Send the response
  res.status(200).json({
    status: "success",
    message: req.t("meals:mealDeletedSuccessfully"),
    data: deletedMeal,
  });
});

//
//
// Update meal for the user
//
exports.updateMeal = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updatedData = req.body;

  // Check if the id parameter is provided
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError(req.t("meals:error.idRequired"), 400));
  }

  // Ensure all necessary fields are provided
  if (
    !updatedData.title ||
    !updatedData.ingredients ||
    !updatedData.nutrition
  ) {
    return next(new AppError(req.t("meals:error.missingRequiredFields"), 400));
  }

  // Check if a meal with the same title already exists for this user
  const existingMeal = await Meal.findOne({
    user: req.user._id,
    title: updatedData.title,
    _id: { $ne: id },
  });

  // If the meal already exists, send an error response
  if (existingMeal) {
    return next(new AppError(req.t("meals:error.titleMustBeUnique"), 400));
  }

  // Query the database for the meal to update
  const meal = await Meal.findOne({
    user: req.user._id,
    _id: id,
  });

  // Check if the meal exists
  if (!meal) {
    return next(new AppError(req.t("meals:error.mealNotFound"), 404));
  }

  // Update the meal fields
  Object.assign(meal, updatedData);
  const updatedMeal = await meal.save();

  // Format response object
  const formattedMeal = updatedMeal.toObject();
  delete formattedMeal.user;
  delete formattedMeal.__v;
  delete formattedMeal.updatedAt;

  console.log("formattedMeal", formattedMeal);
  // Send the response
  res.status(200).json({
    status: "success",
    message: req.t("meals:mealUpdatedSuccessfully"),
    data: formattedMeal,
  });
});
