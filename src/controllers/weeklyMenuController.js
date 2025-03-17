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
 * Create  a copy of a weekly menu.
 */
exports.createWeeklyMenuCopy = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Find the weekly menu by ID
  const weeklyMenu = await WeeklyMenu.findOne({
    user: req.user._id,
    _id: id,
    deletedAt: null,
  });

  // If the weekly menu does not exist, return an error
  if (!weeklyMenu) {
    return next(
      new AppError(req.t("weeklyMenu:errors.weeklyMenuNotFound"), 404),
    );
  }

  // If menu exists, create a copy of it
  // Convert the found document to a plain JS object
  const weeklyMenuObj = weeklyMenu.toObject();

  // Remove the _id, createdAt, and updatedAt fields
  delete weeklyMenuObj._id;
  delete weeklyMenuObj.createdAt;
  delete weeklyMenuObj.updatedAt;

  // Add a random suffix to the title
  const randomSuffix = Math.random().toString(36).substring(2, 8); // e.g. 'ds12fw'

  // Overwrite the title with the original title and add "Copy" to it
  weeklyMenuObj.title = `${weeklyMenu.title} (${req.t("weeklyMenu:copy")}-${randomSuffix})`;
  weeklyMenuObj.archived = false;
  weeklyMenuObj.status = "inactive";
  weeklyMenuObj.activeWeeks = [];

  // Create a new weekly menu
  const newWeeklyMenu = await WeeklyMenu.create(weeklyMenuObj);

  const responseData = {
    status: "success",
    message: req.t("weeklyMenu:messages.createdCopy"),
    data: newWeeklyMenu,
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
      deletedAt: null,
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
    deletedAt: null,
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
  weeklyMenu.deletedAt = Date.now();
  await weeklyMenu.save();

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
    deletedAt: null,
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
      deletedAt: null,
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
    deletedAt: null,
  }).populate({
    path: "days.meals.meal",
    select:
      "title description nutrition image restrictions category preferences ingredients",
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
    deletedAt: null,
  };

  // Add preferences, restrictions, and search query to the dbQuery
  if (preference && preference.length > 0) dbQuery.preferences = preference;
  if (restriction && restriction.length > 0) dbQuery.restrictions = restriction;
  if (query && query.length > 0) {
    dbQuery.$or = [
      { title: { $regex: query.toLowerCase() } },
      { description: { $regex: query.toLowerCase() } },
    ];
  }

  // Get the total number of documents and the documents for the current page
  const [total, totalForFetch, weeklyMenus] = await Promise.all([
    WeeklyMenu.countDocuments({
      user: req.user._id,
      deletedAt: null,
      archived: archived ?? false,
    }),
    WeeklyMenu.countDocuments(dbQuery),
    WeeklyMenu.find(dbQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select(
        "title description preferences restrictions archived status nutrition createdAt updatedAt",
      )
      .lean(),
  ]);

  // Send the response
  res.status(200).json({
    status: "success",
    results: weeklyMenus.length,
    total,
    currentPage: parseInt(page),
    totalPages: Math.ceil(totalForFetch / limit),
    data: weeklyMenus,
  });
});

/**
 * Remove meal from a day in a current weekly menu
 */
exports.removeMealFromWeeklyMenu = catchAsync(async (req, res, next) => {
  const { mealObjectInArrayId, dayId } = req.query;

  // Find the weekly menu by ID and user
  const weeklyMenu = await WeeklyMenu.findOne({
    user: req.user._id,
    _id: req.params.id,
    deletedAt: null,
  });

  if (!weeklyMenu) {
    return next(
      new AppError(req.t("weeklyMenu:errors.weeklyMenuNotFound"), 404),
    );
  }

  // Check if the weekly menu is active
  if (weeklyMenu.status === "active") {
    return res.status(200).json({
      status: "warning",
      message: req.t("weeklyMenu:errors.weeklyMenuActive"),
    });
  }

  // Get the day
  const day = weeklyMenu.days.id(dayId);

  if (!day) {
    return next(new AppError(req.t("weeklyMenu:errors.dayNotFound"), 404));
  }

  // Find the meal object in the day
  const mealIndex = day.meals.findIndex((mealObject) => {
    return mealObject._id.toString() === mealObjectInArrayId.toString();
  });

  if (mealIndex === -1) {
    return next(
      new AppError(req.t("weeklyMenu:errors.mealNotFoundInDay"), 404),
    );
  }

  // Remove the meal from the day
  day.meals.splice(mealIndex, 1);

  // Save the weekly menu
  await weeklyMenu.save();

  // Send the response
  res.status(200).json({
    status: "success",
    message: req.t("weeklyMenu:messages.mealRemoved"),
    data: weeklyMenu.days[0],
  });
});

/**
 *  Add meal to a day in a current weekly menu
 */
exports.addMealsToWeeklyMenu = catchAsync(async (req, res, next) => {
  const { meals, dayId } = req.body;

  // Find the weekly menu by ID and user
  const weeklyMenu = await WeeklyMenu.findOne({
    user: req.user._id,
    _id: req.params.id,
    deletedAt: null,
  });

  if (!weeklyMenu) {
    return next(
      new AppError(req.t("weeklyMenu:errors.weeklyMenuNotFound"), 404),
    );
  }

  // Check if the weekly menu is active
  if (weeklyMenu.status === "active") {
    return res.status(200).json({
      status: "warning",
      message: req.t("weeklyMenu:errors.weeklyMenuActive"),
    });
  }

  let mealList = [];

  if (Array.isArray(meals) && meals.length > 0) {
    // Find the meals by ID and user
    mealList = await Meal.find({
      user: req.user._id,
      _id: { $in: meals },
    });

    if (mealList.length !== meals.length) {
      return next(
        new AppError(req.t("weeklyMenu:errors.someMealNotFound"), 404),
      );
    }
  }

  // Get the day
  const day = weeklyMenu.days.id(dayId);

  if (!day) {
    return next(new AppError(req.t("weeklyMenu:errors.dayNotFound"), 404));
  }

  // Update the day with the meals
  mealList.forEach((meal) => {
    // Add the meal to the day (store only the meal ID)
    day.meals.push({
      meal,
      category: meal.category,
    });
  });

  // Save the weekly menu
  await weeklyMenu.save();

  // Prepare the response message
  const messageForResponse = (() => {
    if (mealList.length > 1) {
      return req.t("weeklyMenu:messages.mealsAdded");
    } else {
      return req.t("weeklyMenu:messages.mealAdded");
    }
  })();

  // Send the response
  res.status(200).json({
    status: "success",
    message: messageForResponse,
    data: weeklyMenu.days[0],
  });
});
