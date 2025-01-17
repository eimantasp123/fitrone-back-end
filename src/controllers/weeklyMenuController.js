const { roundTo } = require("../helper/roundeNumber");
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
    path: "days.meals.meal",
    select:
      "title description nutrition image restrictions category preferences",
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

  // Get the total number of documents and the documents for the current page
  const [total, totalForFetch, weeklyMenus] = await Promise.all([
    WeeklyMenu.countDocuments({ user: req.user._id }),
    WeeklyMenu.countDocuments(dbQuery),
    WeeklyMenu.find(dbQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .select(
        "title description preferences restrictions archived status nutrition createdAt updatedAt",
      ),
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
 *  Add meal to a day in a current weekly menu
 */
exports.addMealsToWeeklyMenu = catchAsync(async (req, res, next) => {
  const { meals, dayId } = req.body;

  await manageMealsInWeeklyMenu({
    req,
    res,
    mealsArray: meals,
    dayId,
    next,
    updateDayMeals: (day, meal) => {
      // Add the meal to the day (store only the meal ID)
      day.meals.push({
        meal: meal._id,
        category: meal.category,
      });
    },
  });
});

/**
 * Remove meal from a day in a current weekly menu
 */
exports.removeMealFromWeeklyMenu = catchAsync(async (req, res, next) => {
  const { mealId, dayId } = req.query;
  const mealsArray = [mealId];

  await manageMealsInWeeklyMenu({
    req,
    res,
    mealsArray,
    dayId,
    next,
    actionType: "remove",
    updateDayMeals: (day, meal) => {
      // Find the meal object in the day
      const mealIndex = day.meals.findIndex((mealObject) => {
        return mealObject.meal.toString() === meal._id.toString();
      });

      if (mealIndex === -1) {
        return next(
          new AppError(req.t("weeklyMenu:errors.mealNotFoundInDay"), 404),
        );
      }

      // Remove the meal from the day
      day.meals.splice(mealIndex, 1);
    },
  });
});

/**
 * General utility to manage meals in a weekly menu
 */
const manageMealsInWeeklyMenu = async ({
  req,
  res,
  dayId,
  mealsArray,
  next,
  updateDayMeals,
  actionType = "add",
}) => {
  // Find the weekly menu by ID and user
  const weeklyMenu = await WeeklyMenu.findOne({
    user: req.user._id,
    _id: req.params.id,
  });

  if (!weeklyMenu) {
    return next(
      new AppError(req.t("weeklyMenu:errors.weeklyMenuNotFound"), 404),
    );
  }

  let mealList = [];

  if (Array.isArray(mealsArray) && mealsArray.length > 0) {
    // Find the meals by ID and user
    mealList = await Meal.find({
      user: req.user._id,
      _id: { $in: mealsArray },
    });

    if (mealList.length !== mealsArray.length) {
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
    updateDayMeals(day, meal);
  });

  // Save the weekly menu
  await weeklyMenu.save();

  // Get current weekly menu day with meals and populate the meals
  const weeklyMenuWithMeal = await WeeklyMenu.findOne(
    {
      user: req.user._id,
      _id: req.params.id,
    },
    {
      days: {
        $elemMatch: {
          _id: dayId,
        },
      },
    },
  ).populate({
    path: "days.meals.meal",
    select:
      "title nutrition description image restrictions category preferences",
  });

  // Prepare the response message
  const messageForResponse = (() => {
    if (actionType === "add" && mealList.length > 1) {
      return req.t("weeklyMenu:messages.mealsAdded");
    } else if (actionType === "add" && mealList.length === 1) {
      return req.t("weeklyMenu:messages.mealAdded");
    } else {
      return req.t("weeklyMenu:messages.mealRemoved");
    }
  })();

  // Send the response
  res.status(200).json({
    status: "success",
    message: messageForResponse,
    data: weeklyMenuWithMeal.days[0],
  });
};
