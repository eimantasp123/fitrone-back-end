const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Meal = require("../models/Meal");
const { default: mongoose } = require("mongoose");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const {
  validateFile,
  uploadToS3,
  deleteFromS3,
} = require("../utils/s3Helpers");
const Ingredient = require("../models/Ingredient");
const { roundTo } = require("../helper/roundeNumber");

/**
 * Multer middleware for file upload
 */
const storage = multer.memoryStorage();
exports.upload = multer({ storage });

/**
 * Constants for image upload
 */
const DEFAULT_IMAGE_URL =
  "https://fitronelt.s3.eu-north-1.amazonaws.com/cb169cd415.jpg";
const maxFileSize = 5 * 1024 * 1024; // 5MB
const allowedFileTypes = ["image/jpeg", "image/png", "image/jpg"]; // Allowed image types

/**
 * Add a new meal for the user
 */
exports.addMeal = catchAsync(async (req, res, next) => {
  const { title, description, category } = req.body;
  const { lng } = req;

  // Ensure required fields are present
  if (!title || !category || !req.body.ingredients) {
    return next(new AppError(req.t("meals:error.missingRequiredFields"), 400));
  }

  // Parse JSON fields
  const ingredients = JSON.parse(req.body.ingredients);
  const preferences = req.body.preferences
    ? JSON.parse(req.body.preferences)
    : [];
  const restrictions = req.body.restrictions
    ? JSON.parse(req.body.restrictions)
    : [];

  // Validate and fetch ingredient details
  const ingredientDetails = await Promise.all(
    ingredients.map(async (ingredient) => {
      const ingredientDoc = await Ingredient.findOne({
        _id: ingredient.id,
        user: req.user._id,
      });

      if (!ingredientDoc) {
        return next(new AppError(req.t("meals:error.noIngredientsFound"), 404));
      }

      // Calculate the nutrition info based on the current amount
      const scalingFactor = ingredient.currentAmount / ingredientDoc.amount;

      return {
        ingredientId: ingredient.id,
        title: ingredientDoc.title[lng],
        currentAmount: Number(ingredient.currentAmount),
        unit: ingredientDoc.unit,
        calories: roundTo(ingredientDoc.calories * scalingFactor, 1),
        protein: roundTo(ingredientDoc.protein * scalingFactor, 1),
        fat: roundTo(ingredientDoc.fat * scalingFactor, 1),
        carbs: roundTo(ingredientDoc.carbs * scalingFactor, 1),
      };
    }),
  );

  // Calculate the total nutrition info for the meal
  const totalNutrition = ingredientDetails.reduce(
    (acc, curr) => {
      acc.calories = roundTo(acc.calories + curr.calories, 1);
      acc.protein = roundTo(acc.protein + curr.protein, 1);
      acc.fat = roundTo(acc.fat + curr.fat, 1);
      acc.carbs = roundTo(acc.carbs + curr.carbs, 1);
      return acc;
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );

  // Check if a meal with the same title already exists for this user
  const existingMeal = await Meal.findOne({
    user: req.user._id,
    title: title,
  });
  if (existingMeal) {
    return next(new AppError(req.t("meals:error.titleMustBeUnique"), 400));
  }

  // Handle image upload if provided
  let mealImageUrl = DEFAULT_IMAGE_URL;
  if (req.file) {
    // Validate file type and size
    if (!validateFile(req.file, allowedFileTypes, maxFileSize)) {
      return next(new AppError(req.t("meals:error.invalidImageFile"), 400));
    }

    // Compress and upload image
    try {
      const userId = req.user._id.toString();
      const fileName = `users/${userId}/meals/${uuidv4()}-${req.file.originalname}`;

      const compressedImageBuffer = await sharp(req.file.buffer)
        .resize({ width: 800 })
        .jpeg({ quality: 80 })
        .toBuffer();

      mealImageUrl = await uploadToS3(
        fileName,
        compressedImageBuffer,
        req.file.mimetype,
      );
    } catch (error) {
      return next(new AppError(req.t("meals:error.uploadingImage"), 500));
    }
  }

  // Build the meal object based on the request data
  const newMeal = await Meal.create({
    user: req.user._id,
    title,
    description: description || "",
    image: mealImageUrl,
    ingredients: ingredientDetails,
    nutrition: totalNutrition,
    preferences,
    restrictions,
    category,
  });

  // Format response object
  const formattedMeal = newMeal.toObject();
  delete formattedMeal.user;
  delete formattedMeal.__v;
  delete formattedMeal.updatedAt;

  const responseData = {
    status: "success",
    message: req.t("meals:mealAddedSuccessfully"),
    data: formattedMeal,
  };

  if (req.warning) {
    responseData.warning = req.warning;
  }

  // Send the response
  res.status(201).json(responseData);
});

/**
 * Update a meal for the user
 */
exports.updateMeal = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { title, description, category } = req.body;
  const { lng } = req;

  // Check if the id parameter is provided
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError(req.t("meals:error.idRequired"), 400));
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

  // Ensure all necessary fields are provided
  if (!title || !category || !req.body.ingredients) {
    return next(new AppError(req.t("meals:error.missingRequiredFields"), 400));
  }

  // Check if a meal with the same title already exists for this user
  const existingMeal = await Meal.findOne({
    user: req.user._id,
    title: title,
    _id: { $ne: id },
  });

  // If the meal already exists, send an error response
  if (existingMeal) {
    return next(new AppError(req.t("meals:error.titleMustBeUnique"), 400));
  }

  // Parse JSON fields
  const ingredients = JSON.parse(req.body.ingredients);
  const preferences = req.body.preferences
    ? JSON.parse(req.body.preferences)
    : [];
  const restrictions = req.body.restrictions
    ? JSON.parse(req.body.restrictions)
    : [];

  // Validate that `ingredients` is an array of objects
  const ingredientDetails = await Promise.all(
    ingredients.map(async (ingredient) => {
      const ingredientDoc = await Ingredient.findOne({
        _id: ingredient.id,
        user: req.user._id,
      });

      if (!ingredientDoc) {
        return next(new AppError(req.t("meals:error.noIngredientsFound"), 404));
      }

      // Calculate the nutrition info based on the current amount
      const scalingFactor = ingredient.currentAmount / ingredientDoc.amount;
      return {
        ingredientId: ingredient.id,
        title: ingredientDoc.title[lng],
        currentAmount: Number(ingredient.currentAmount),
        unit: ingredientDoc.unit,
        calories: roundTo(ingredientDoc.calories * scalingFactor, 1),
        protein: roundTo(ingredientDoc.protein * scalingFactor, 1),
        fat: roundTo(ingredientDoc.fat * scalingFactor, 1),
        carbs: roundTo(ingredientDoc.carbs * scalingFactor, 1),
      };
    }),
  );

  // Calculate the total nutrition info for the meal
  const totalNutrition = ingredientDetails.reduce(
    (acc, curr) => {
      acc.calories = roundTo(acc.calories + curr.calories, 1);
      acc.protein = roundTo(acc.protein + curr.protein, 1);
      acc.fat = roundTo(acc.fat + curr.fat, 1);
      acc.carbs = roundTo(acc.carbs + curr.carbs, 1);
      return acc;
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );

  // Handle image upload/update
  if (req.file) {
    // Validate file type and size
    if (!validateFile(req.file, allowedFileTypes, maxFileSize)) {
      return next(new AppError(req.t("meals:error.invalidImageFile"), 400));
    }

    // Delete the old image if it's not the default image
    if (meal.image && !meal.image.includes(DEFAULT_IMAGE_URL)) {
      const s3Key = meal.image.replace(
        `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`,
        "",
      );
      try {
        await deleteFromS3(s3Key);
      } catch (error) {
        return next(new AppError(req.t("meals:error.imageDeleteFailed"), 500));
      }
    }

    // Compress and upload the new image
    try {
      const newImageKey = `users/${req.user._id}/meals/${uuidv4()}-${req.file.originalname}`;
      const compressedImageBuffer = await sharp(req.file.buffer)
        .resize({ width: 800 })
        .jpeg({ quality: 80 })
        .toBuffer();
      meal.image = await uploadToS3(
        newImageKey,
        compressedImageBuffer,
        req.file.mimetype,
      );
    } catch (error) {
      return next(new AppError(req.t("meals:error.uploadingImage"), 500));
    }
  } else if (req.body.image === "delete") {
    // If image deletion is requested, delete the old image and set to default
    if (meal.image && !meal.image.includes(DEFAULT_IMAGE_URL)) {
      const s3Key = meal.image.replace(
        `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`,
        "",
      );
      try {
        await deleteFromS3(s3Key);
      } catch (error) {
        return next(new AppError(req.t("meals:error.imageDeleteFailed"), 500));
      }
    }
    meal.image = DEFAULT_IMAGE_URL;
  }

  // Update the meal
  meal.title = title;
  if (description || description === "") {
    meal.description = description;
  } else {
    meal.description = meal.description;
  }
  meal.category = category || meal.category;
  meal.ingredients = ingredientDetails;
  meal.nutrition = totalNutrition;
  meal.preferences = preferences;
  meal.restrictions = restrictions;

  // Update the meal fields
  const updatedMeal = await meal.save();

  // Format response object
  const formattedMeal = updatedMeal.toObject();
  delete formattedMeal.user;
  delete formattedMeal.__v;
  delete formattedMeal.updatedAt;

  // Send the response
  res.status(200).json({
    status: "success",
    message: req.t("meals:mealUpdatedSuccessfully"),
    data: formattedMeal,
  });
});

/**
 * Delete a meal for the user
 */
exports.deleteMeal = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Check if the id parameter is provided
  if (!id) {
    return next(new AppError(req.t("meals:error.idRequired"), 400));
  }

  // Query the database for the meal to delete
  const mealToDelete = await Meal.findOne({
    user: req.user._id,
    _id: id,
  }).select("-user");

  // Check if the meal exists
  if (!mealToDelete) {
    return next(new AppError(req.t("meals:error.mealNotFound"), 404));
  }

  // Delete image from S3 if it exists and is not the default image
  if (mealToDelete.image && !mealToDelete.image.includes(DEFAULT_IMAGE_URL)) {
    const s3Key = mealToDelete.image.replace(
      `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`,
      "",
    );
    try {
      await deleteFromS3(s3Key);
    } catch (error) {
      return next(new AppError(req.t("meals:error.imageDeleteFailed"), 500));
    }
  }

  // Delete the meal
  await mealToDelete.deleteOne();

  // Send the response
  res.status(200).json({
    status: "success",
    message: req.t("meals:mealDeletedSuccessfully"),
    data: mealToDelete,
  });
});

/**
 * Get all meals for the user
 */
exports.getMeals = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    category,
    preference,
    restriction,
    query,
  } = req.query;

  // Pagination options
  const skip = (page - 1) * limit;

  // Query the database for all meals for the user
  const dbQuery = { user: req.user._id, archived: false };

  // Add filters if provided
  if (category) {
    dbQuery.category = category;
  }

  if (preference) {
    dbQuery.preferences = preference;
  }

  if (restriction) {
    dbQuery.restrictions = restriction;
  }

  if (query && query.length > 0) {
    dbQuery.title = { $regex: query, $options: "i" };
  }

  // Get the total number of results
  const total = await Meal.countDocuments(dbQuery);

  // Fetch filtered meals with pagination
  const meals = await Meal.find(dbQuery)
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
    total,
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    data: formattedMeals,
  });
});

/**
 * Get all meal by category, preference, restriction or search query
 */
exports.searchMeals = catchAsync(async (req, res, next) => {
  const {
    limit = 10,
    category,
    preference,
    restriction,
    searchQuery,
  } = req.query;

  // Query the database for all meals for the user
  const DbQuery = { user: req.user._id, archived: false };

  // Add filters if provided
  if (category) {
    DbQuery.category = category;
  }

  if (preference) {
    DbQuery.preferences = preference;
  }

  if (restriction) {
    DbQuery.restrictions = restriction;
  }

  if (searchQuery && searchQuery.length > 0) {
    DbQuery.title = { $regex: searchQuery, $options: "i" };
  }

  // Fetch filtered meals with pagination
  const meals = await Meal.find(DbQuery)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 })
    .select("title category"); // Newest first

  // Send the response
  res.status(200).json({
    status: "success",
    data: meals,
  });
});

/**
 * Get a meal by ID
 */
exports.getMealById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Check if the id parameter is provided
  if (!id) {
    return next(new AppError(req.t("meals:error.idRequired"), 400));
  }

  // Query the database for the meal
  const meal = await Meal.findOne({
    user: req.user._id,
    _id: id,
  });

  // Check if the meal exists
  if (!meal) {
    return next(new AppError(req.t("meals:error.mealNotFound"), 404));
  }

  // Format response object
  const formattedMeal = meal.toObject();
  delete formattedMeal.user;
  delete formattedMeal.__v;
  delete formattedMeal.updatedAt;

  // Send the response
  res.status(200).json({
    status: "success",
    data: formattedMeal,
  });
});
