const WeeklyMenu = require("../models/WeeklyMenu");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

/**
 * Create a new weekly menu.
 */
exports.createWeeklyMenu = catchAsync(async (req, res, next) => {
  const { title, description, restrictions, preferences } = req.body;

  // Check does the user already have a weekly menu with the same title
  const existingWeeklyMenu = await WeeklyMenu.findOne({
    user: req.user._id,
    title,
  });

  // If the weekly menu already exists, return an error
  if (existingWeeklyMenu) {
    return next(
      new AppError(req.t("weeklyMenu:errors.titleAlreadyExists"), 400),
    );
  }

  // If the weekly menu does not exist, create a new one
  const weeklyMenu = await WeeklyMenu.create({
    user: req.user._id,
    title,
    description,
    restrictions,
    preferences,
  });

  // Send the response
  res.status(200).json({
    status: "success",
    data: {
      weeklyMenu,
    },
  });
});

/**
 * Update a weekly menu.
 */
exports.updateWeeklyMenu = catchAsync(async (req, res, next) => {
  // Prepare the updates
  const updates = {};
  if (req.body.title) updates.title = req.body.title;
  if (req.body.description) updates.description = req.body.description;
  if (req.body.restrictions) updates.restrictions = req.body.restrictions;
  if (req.body.preferences) updates.preferences = req.body.preferences;

  // Find the weekly menu by ID
  const updatedMenu = await WeeklyMenu.findOneAndUpdate(
    {
      user: req.user._id,
      _id: req.params.id,
    },
    {
      $set: updates,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  // If the weekly menu does not exist, return an error
  if (!updatedMenu) {
    return next(
      new AppError(req.t("weeklyMenu:errors.weeklyMenuNotFound"), 404),
    );
  }

  // Send the response
  res.status(200).json({
    status: "success",
    data: {
      updatedMenu,
    },
  });
});
