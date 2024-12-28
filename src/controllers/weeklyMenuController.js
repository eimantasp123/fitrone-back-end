const Meal = require("../models/Meal");
const WeeklyMenu = require("../models/WeeklyMenu");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

/**
 * Create a new weekly menu.
 */
exports.createWeeklyMenu = catchAsync(async (req, res, next) => {
  const { title, description, restrictions, preferences } = req.body;

  // Create an array of 7 days
  const days = Array.from({ length: 7 }, (_, i) => ({
    day: i,
    meals: [],
  }));

  // If the weekly menu does not exist, create a new one
  await WeeklyMenu.create({
    user: req.user._id,
    title,
    description,
    restrictions,
    preferences,
    days,
  });

  const responseData = {
    status: "success",
    message: req.t("weeklyMenu:messages.created"),
  };

  if (req.warning) {
    responseData.warning = req.warning;
  }

  // Send the response
  res.status(200).json(responseData);
});

/**
 * Update a weekly menu.
 */
exports.updateWeeklyMenuBio = catchAsync(async (req, res, next) => {
  // Prepare the updates
  const updates = {};
  if (req.body.title) updates.title = req.body.title;
  if (req.body.description || req.body.description === "")
    updates.description = req.body.description;
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
  ).select("title description preferences restrictions");

  // If the weekly menu does not exist, return an error
  if (!updatedMenu) {
    return next(
      new AppError(req.t("weeklyMenu:errors.weeklyMenuNotFound"), 404),
    );
  }

  // Send the response
  res.status(200).json({
    status: "success",
    message: req.t("weeklyMenu:messages.updated"),
    data: updatedMenu,
  });
});

/**
 * Delete a weekly menu.
 */
exports.deleteWeeklyMenu = catchAsync(async (req, res, next) => {
  // Find the weekly menu by ID
  const weeklyMenu = await WeeklyMenu.findOne({
    user: req.user._id,
    _id: req.params.id,
  });

  // If the weekly menu does not exist, return an error
  if (!weeklyMenu) {
    return next(
      new AppError(req.t("weeklyMenu:errors.weeklyMenuNotFound"), 404),
    );
  }

  // If the weekly menu is active, return an error
  if (weeklyMenu.status === "active") {
    return next(new AppError(req.t("weeklyMenu:errors.weeklyMenuActive"), 400));
  }

  // Delete the weekly menu
  await weeklyMenu.deleteOne();

  // Send the response
  res.status(200).json({
    status: "success",
    message: req.t("weeklyMenu:messages.deleted"),
  });
});

/**
 * Archive a weekly menu.
 */

exports.archiveWeeklyMenu = catchAsync(async (req, res, next) => {
  // Find the weekly menu by ID
  const weeklyMenu = await WeeklyMenu.findOne({
    user: req.user._id,
    _id: req.params.id,
  });

  // If the weekly menu does not exist, return an error
  if (!weeklyMenu) {
    return next(
      new AppError(req.t("weeklyMenu:errors.weeklyMenuNotFound"), 404),
    );
  }

  // If the weekly menu is active, return an error
  if (weeklyMenu.status === "active") {
    return next(new AppError(req.t("weeklyMenu:errors.weeklyMenuActive"), 400));
  }

  // Archive the weekly menu
  weeklyMenu.archived = true;
  await weeklyMenu.save();

  // Send the response
  res.status(200).json({
    status: "success",
    message: req.t("weeklyMenu:messages.archived"),
    data: {
      id: weeklyMenu._id,
      status: weeklyMenu.archived,
    },
  });
});

/**
 * Unarchive a weekly menu.
 */

exports.unarchiveWeeklyMenu = catchAsync(async (req, res, next) => {
  // Find the weekly menu by ID
  const weeklyMenu = await WeeklyMenu.findOneAndUpdate(
    {
      user: req.user._id,
      _id: req.params.id,
    },
    {
      archived: false,
    },
    {
      new: true,
    },
  );

  // If the weekly menu does not exist, return an error
  if (!weeklyMenu) {
    return next(
      new AppError(req.t("weeklyMenu:errors.weeklyMenuNotFound"), 404),
    );
  }

  const responseData = {
    status: "success",
    message: req.t("weeklyMenu:messages.unarchived"),
    data: {
      id: weeklyMenu._id,
      status: weeklyMenu.archived,
    },
  };

  if (req.warning) {
    responseData.warning = req.warning;
  }

  // Send the response
  res.status(200).json(responseData);
});

/**
 * Get a weekly menu by ID.
 */
exports.getWeeklyMenuById = catchAsync(async (req, res, next) => {
  // Find the weekly menu by ID
  const weeklyMenu = await WeeklyMenu.findOne({
    user: req.user._id,
    _id: req.params.id,
  }).populate({
    path: "days.meals.mealId",
    select:
      "title nutrition description image restrictions category preferences",
  });

  // If the weekly menu does not exist, return an error
  if (!weeklyMenu) {
    return next(
      new AppError(req.t("weeklyMenu:errors.weeklyMenuNotFound"), 404),
    );
  }

  // Send the response
  res.status(200).json({
    status: "success",
    data: weeklyMenu,
  });
});

/**
 * Get all weekly menus.
 */
exports.getAllWeeklyMenus = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    preference,
    restriction,
    archived,
    query,
  } = req.query;

  // Pagination options
  const skip = (page - 1) * limit;

  // Query options
  const dbQuery = {
    user: req.user._id,
    archived: archived ?? false,
  };

  // Add preferences, restrictions, and search query to the dbQuery
  if (preference && preference.length > 0) {
    dbQuery.preferences = preference;
  }

  if (restriction && restriction.length > 0) {
    dbQuery.restrictions = restriction;
  }

  if (query && query.length > 0) {
    dbQuery.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ];
  }

  // Get the total number of results
  const totalResults = await WeeklyMenu.countDocuments(dbQuery);

  // Find all weekly menus for the user
  const weeklyMenus = await WeeklyMenu.find(dbQuery)
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 })
    .select(
      "title description preferences restrictions archived status nutrition createdAt updatedAt",
    );

  // Send the response
  res.status(200).json({
    status: "success",
    results: weeklyMenus.length,
    totalResults,
    totalPages: Math.ceil(totalResults / limit),
    currentPage: parseInt(page),
    data: weeklyMenus,
  });
});

/**
 *  Add meal to a day in a current weekly menu
 */

exports.addMealToWeeklyMenu = catchAsync(async (req, res, next) => {
  const { mealId, dayId } = req.query;

  // Find the weekly menu by ID and user
  const weeklyMenu = await WeeklyMenu.findOne({
    user: req.user._id,
    _id: req.params.id,
  });

  // If the weekly menu does not exist, return an error
  if (!weeklyMenu) {
    return next(
      new AppError(req.t("weeklyMenu:errors.weeklyMenuNotFound"), 404),
    );
  }

  // Find the meal by ID and user
  const meal = await Meal.findOne(
    {
      user: req.user._id,
      _id: mealId,
      archived: false,
    },
    "title nutrition description image restrictions category preferences",
  );

  console.log(meal);

  // If the meal does not exist, return an error
  if (!meal) {
    return next(new AppError(req.t("weeklyMenu:errors.mealNotFound"), 404));
  }

  // Get the day
  const day = weeklyMenu.days.id(dayId);

  // If the day does not exist, return an error
  if (!day) {
    return next(new AppError(req.t("weeklyMenu:errors.dayNotFound"), 404));
  }

  // Add the meal to the day (store only the meal ID)
  day.meals.push({
    mealId: meal._id,
    category: meal.category,
    time: req.body.time,
  });

  // Save the weekly menu
  await weeklyMenu.save();

  // Send the response
  res.status(200).json({
    status: "success",
    message: req.t("weeklyMenu:messages.mealAdded"),
    data: {
      meal,
    },
  });
});

/**
 * Remove meal from a day in a current weekly menu
 */

exports.removeMealFromWeeklyMenu = catchAsync(async (req, res, next) => {
  const { mealObjectId, dayId } = req.query;

  // Find the weekly menu by ID and user
  const weeklyMenu = await WeeklyMenu.findOne({
    user: req.user._id,
    _id: req.params.id,
  });

  // If the weekly menu does not exist, return an error

  if (!weeklyMenu) {
    return next(
      new AppError(req.t("weeklyMenu:errors.weeklyMenuNotFound"), 404),
    );
  }

  // Get the day
  const day = weeklyMenu.days.id(dayId);

  // If the day does not exist, return an error
  if (!day) {
    return next(new AppError(req.t("weeklyMenu:errors.dayNotFound"), 404));
  }

  // Remove the meal from the day
  day.meals.pull(mealObjectId);

  // Save the weekly menu
  await weeklyMenu.save();

  // Send the response
  res.status(200).json({
    status: "success",
    data: {
      mealObjectId,
    },
  });
});
