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
} = require("../utils/s3helpers");
const Ingredient = require("../models/Ingredient");
const WeeklyMenu = require("../models/WeeklyMenu");
const WeeklyPlan = require("../models/WeeklyPlan");
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
        title: ingredientDoc.title,
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
  const existingMeal = await Meal.exists({
    user: req.user._id,
    title: title,
    deletedAt: null,
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
  await Meal.create({
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

  const responseData = {
    status: "success",
    message: req.t("meals:mealAddedSuccessfully"),
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
  const existingMeal = await Meal.exists({
    user: req.user._id,
    title: title.trim().toLowerCase(),
    _id: { $ne: id },
    deletedAt: null,
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
        title: ingredientDoc.title,
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
      // Check if this image is still referenced in any WeeklyMenu snapshot
      const isInUse = await WeeklyMenu.findOne({
        user: req.user._id,
        "days.meals.meal.image": meal.image,
      });

      // Check WeeklyPlan
      const isInUsePlan = await WeeklyPlan.findOne({
        user: req.user._id,
        "assignMenu.menuSnapshot.days.meals.meal.image": mealToDelete.image,
      });

      // If it's not in use anywhere, it's safe to remove from S3
      if (!isInUse && !isInUsePlan) {
        const s3Key = meal.image.replace(
          `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`,
          "",
        );
        try {
          await deleteFromS3(s3Key);
        } catch (error) {
          return next(
            new AppError(req.t("meals:error.imageDeleteFailed"), 500),
          );
        }
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
      // Check if this image is still referenced in any WeeklyMenu snapshot
      const isInUse = await WeeklyMenu.findOne({
        user: req.user._id,
        "days.meals.meal.image": meal.image,
      });

      // Check WeeklyPlan
      const isInUsePlan = await WeeklyPlan.findOne({
        user: req.user._id,
        "assignMenu.menuSnapshot.days.meals.meal.image": meal.image,
      });

      // If it's not in use anywhere, it's safe to remove from S3
      if (!isInUse && !isInUsePlan) {
        const s3Key = meal.image.replace(
          `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`,
          "",
        );
        try {
          await deleteFromS3(s3Key);
        } catch (error) {
          return next(
            new AppError(req.t("meals:error.imageDeleteFailed"), 500),
          );
        }
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
  await meal.save();

  // Send the response
  res.status(200).json({
    status: "success",
    message: req.t("meals:mealUpdatedSuccessfully"),
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
    // Check if this image is still referenced in any WeeklyMenu snapshot
    const isInUse = await WeeklyMenu.findOne({
      user: req.user._id,
      "days.meals.meal.image": mealToDelete.image,
    });

    // Check WeeklyPlan
    const isInUsePlan = await WeeklyPlan.findOne({
      user: req.user._id,
      "assignMenu.menuSnapshot.days.meals.meal.image": mealToDelete.image,
    });

    // If it's not in use anywhere, it's safe to remove from S3
    if (!isInUse && !isInUsePlan) {
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
  }

  // Delete the meal
  mealToDelete.deletedAt = new Date();
  await mealToDelete.save();

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
  const dbQuery = { user: req.user._id, archived: false, deletedAt: null };

  // Add filters if provided
  if (category) dbQuery.category = category;
  if (preference) dbQuery.preferences = preference;
  if (restriction) dbQuery.restrictions = restriction;
  if (query && query.length > 0)
    dbQuery.title = new RegExp("^" + query.toLowerCase(), "i");

  // Count the total number of meals and fetch the meals with pagination
  const [total, totalForFetch, meals] = await Promise.all([
    Meal.countDocuments({
      user: req.user._id,
      archived: false,
      deletedAt: null,
    }),
    Meal.countDocuments(dbQuery),
    Meal.find(dbQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("-user -__v -updatedAt")
      .lean(),
  ]);

  // Send the response
  res.status(200).json({
    status: "success",
    results: meals.length,
    total,
    currentPage: parseInt(page),
    totalPages: Math.ceil(totalForFetch / limit),
    data: meals,
  });
});
