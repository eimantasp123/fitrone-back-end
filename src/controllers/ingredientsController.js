const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const openai = require("openai");
const z = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
const UserIngredient = require("../models/UserIngredient");
const Meal = require("../models/Meal");
const { default: mongoose } = require("mongoose");

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

  // Check if user has the ingredient document
  let userIngredients = await UserIngredient.findOne({ user: req.user._id });

  // If user ingredient document does not exist, create a new one
  if (!userIngredients) {
    userIngredients = new UserIngredient({
      user: req.user._id,
      lang,
      ingredients: [],
    });
  }

  // Check if the ingredient already exists in the user ingredient document
  const ingredientExists = userIngredients.ingredients.find(
    (ingredient) =>
      ingredient.title[lang].toLowerCase() === title.toLowerCase(),
  );

  // If the ingredient already exists, send an error response
  if (ingredientExists) {
    return next(new AppError(req.t("meals:error.ingredientExists"), 400));
  }

  // Add the new ingredient to the existing document
  userIngredients.ingredients.push({
    title: { en: title, lt: title },
    unit,
    calories,
    protein,
    carbs,
    fat,
    amount,
  });

  // Save the user ingredient document
  await userIngredients.save();

  // Get the newly added ingredient
  const newIngredient =
    userIngredients.ingredients[userIngredients.ingredients.length - 1];

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

  // Send the response
  res.status(201).json({
    status: "success",
    message: req.t("meals:ingredientAddedSuccesfuly"),
    data: nutritionInfo,
  });
});

//
//
// Get all ingredients for the user
//
exports.getIngredients = catchAsync(async (req, res, next) => {
  // Query the database for the user ingredient document
  const userIngredients = await UserIngredient.findOne({ user: req.user._id });

  if (!userIngredients) {
    return next(new AppError(req.t("meals:error.noIngredientsFound"), 404));
  }

  // Get the language from the request object
  const lang = req.lng || "en";

  const sortIngredients = userIngredients.ingredients.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  // Paginate the ingredients
  const ingredients = sortIngredients.map((ingredient) => ({
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
    results: ingredients.length,
    data: ingredients,
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

  // Query the database for the user ingredient document
  const userIngredients = await UserIngredient.findOne({ user: req.user._id });

  // Check if the user ingredient document exists
  if (!userIngredients) {
    return next(new AppError(req.t("meals:error.noIngredientsFound"), 404));
  }

  // Find the index of the ingredient to delete
  const ingredientIndex = userIngredients.ingredients.findIndex(
    (ingredient) => ingredient._id.toString() === ingredientId,
  );

  // Check if the ingredient exists
  if (ingredientIndex === -1) {
    return next(new AppError(req.t("meals:error.ingredientNotFound"), 404));
  }

  // Get the ingredient details before deletion
  const ingredientToDelete = userIngredients.ingredients[ingredientIndex];

  // Remove the ingredient from the user's ingredient list
  userIngredients.ingredients.splice(ingredientIndex, 1);
  await userIngredients.save();

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
    const newNutrition = meal.ingredients.reduce(
      (acc, curr) => {
        acc.calories = Number((acc.calories + curr.calories).toFixed(1));
        acc.protein = Number((acc.protein + curr.protein).toFixed(1));
        acc.fat = Number((acc.fat + curr.fat).toFixed(1));
        acc.carbs = Number((acc.carbs + curr.carbs).toFixed(1));
        return acc;
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0 },
    );

    // Update the meal's nutrition info
    meal.nutrition = newNutrition;

    // Save the updated meal
    await meal.save();
  }

  // Send the response
  res.status(200).json({
    status: "success",
    message: req.t("meals:ingredientDeletedSuccessfully"),
    data: {
      ingredient: ingredientToDelete,
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

  // Query the database for the user ingredient document
  const userIngredients = await UserIngredient.findOne({ user: req.user._id });

  // Check if the user ingredient document exists
  if (!userIngredients) {
    return next(new AppError(req.t("meals:error.noIngredientsFound"), 404));
  }

  // Check if the ingredient title already exists in the user ingredient document on other ingredient
  const ingredientExists = userIngredients.ingredients.find(
    (ingredient) =>
      ingredient.title[lang].toLowerCase() === title.toLowerCase() &&
      ingredient._id.toString() !== ingredientId,
  );

  if (ingredientExists) {
    return next(new AppError(req.t("meals:error.ingredientExists"), 400));
  }

  // Find the index of the ingredient to update
  const ingredientIndex = userIngredients.ingredients.findIndex(
    (ingredient) => ingredient._id.toString() === ingredientId,
  );

  // Check if the ingredient exists
  if (ingredientIndex === -1) {
    return next(new AppError(req.t("meals:error.ingredientNotFound"), 404));
  }

  // Update the ingredient
  userIngredients.ingredients[ingredientIndex].title = { en: title, lt: title };
  userIngredients.ingredients[ingredientIndex].unit = unit;
  userIngredients.ingredients[ingredientIndex].calories = calories;
  userIngredients.ingredients[ingredientIndex].protein = protein;
  userIngredients.ingredients[ingredientIndex].carbs = carbs;
  userIngredients.ingredients[ingredientIndex].amount = amount;
  userIngredients.ingredients[ingredientIndex].fat = fat;

  // Save the user ingredient document
  await userIngredients.save();

  // Get the updated ingredient
  const updatedIngredient = userIngredients.ingredients[ingredientIndex];

  // Recalculate meals that use this ingredient
  const mealsToUpdate = await Meal.find({
    user: req.user._id,
    "ingredients.ingredientId": ingredientId,
  });

  // Update the meals that use the updated ingredient
  for (const meal of mealsToUpdate) {
    meal.ingredients = meal.ingredients.map((mealIngredient) => {
      if (mealIngredient.ingredientId.toString() === ingredientId) {
        const scalingFactor =
          mealIngredient.currentAmount / updatedIngredient.amount;

        return {
          ...mealIngredient._doc,
          title: updatedIngredient.title[lang],
          unit: updatedIngredient.unit,
          calories: Number(
            (updatedIngredient.calories * scalingFactor).toFixed(1),
          ),
          protein: Number(
            (updatedIngredient.protein * scalingFactor).toFixed(1),
          ),
          fat: Number((updatedIngredient.fat * scalingFactor).toFixed(1)),
          carbs: Number((updatedIngredient.carbs * scalingFactor).toFixed(1)),
        };
      }
      return mealIngredient;
    });

    // Recalculate the total nutrition info for the meal
    const newNutrition = meal.ingredients.reduce(
      (acc, curr) => {
        acc.calories = Number((acc.calories + curr.calories).toFixed(1));
        acc.protein = Number((acc.protein + curr.protein).toFixed(1));
        acc.fat = Number((acc.fat + curr.fat).toFixed(1));
        acc.carbs = Number((acc.carbs + curr.carbs).toFixed(1));
        return acc;
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0 },
    );

    meal.nutrition = newNutrition;

    // Save the updated meal
    await meal.save();
  }

  // Send the response
  res.status(200).json({
    status: "success",
    message: req.t("meals:ingredientUpdatedSuccessfully"),
    data: {
      ingredientId: updatedIngredient._id,
      title: updatedIngredient.title[lang],
      unit: updatedIngredient.unit,
      amount: updatedIngredient.amount,
      calories: updatedIngredient.calories,
      protein: updatedIngredient.protein,
      fat: updatedIngredient.fat,
      carbs: updatedIngredient.carbs,
    },
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
        ingredientId: ingredient._id,
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

  // Query the database for the ingredient
  const userIngredient = await UserIngredient.findOne(
    { user: new mongoose.Types.ObjectId(req.user._id) },
    {
      ingredients: {
        $elemMatch: {
          _id: new mongoose.Types.ObjectId(ingredientId),
        },
      },
    },
  );

  // Check if the ingredient exists
  if (!userIngredient.ingredients.length) {
    return next(new AppError(req.t("meals:error.ingredientNotFound"), 404));
  }

  // Get the ingredient object
  const ingredient = userIngredient.ingredients[0];

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
