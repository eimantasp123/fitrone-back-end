const Meal = require("../models/Meal");
const WeekPlan = require("../models/WeekPlan");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const _ = require("lodash");
const { inValidDate } = require("../utils/generalHelpers");
const { fromZonedTime } = require("date-fns-tz");
const { default: mongoose } = require("mongoose");

/**
 * Set user timezone
 */
exports.setUserTimezone = catchAsync(async (req, res, next) => {
  const { timezone } = req.body;
  // Check if timezone is provided
  if (!timezone) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.timezoneRequired"), 400),
    );
  }

  // Update user timezone
  req.user.timezone = timezone;
  await req.user.save();

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("weekPlan:messages.timezoneSetSuccess"),
    data: {
      timezone: req.user.timezone,
    },
  });
});

/**
 * Get week plan by date
 */
exports.getWeekPlanByDateAndCreate = catchAsync(async (req, res, next) => {
  const { year, week } = req.query;

  // Check if year and week are provided
  if (!year || !week) {
    return next(
      new AppError(
        req.t("weekPlan:validationErrors.yearAndWeekNumberIsNotProvided"),
        400,
      ),
    );
  }

  // Find week plan for the user with the provided year and week
  let weekPlan = await WeekPlan.findOne({
    user: req.user._id,
    year: parseInt(year),
    weekNumber: parseInt(week),
  }).populate({
    path: "assignMenu.menu",
    select: "title description preferences restrictions",
  });

  // If week plan is not found and timezone is set, create a new week plan
  if (!weekPlan && req.user.timezone) {
    weekPlan = await WeekPlan.create({
      user: req.user._id,
      year: parseInt(year),
      weekNumber: parseInt(week),
    });

    // If week plan is not found and timezone is not set, return not found with empty data
  } else if (!weekPlan && !req.user.timezone) {
    return res.status(200).json({
      status: "not_found",
      data: [],
    });
  }
  // 4. If week plan is found, return the week plan with populated data

  res.status(200).json({
    status: "success",
    data: weekPlan,
    timezone: req.user.timezone,
  });
});

/**
 * Create a new week plan for the user
 */
exports.assignMenu = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { menus } = req.body;

  // Check if id is valid
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.invalidObjectId"), 400),
    );
  }

  // Check if assignMenu is provided
  if (!menus || !Array.isArray(menus)) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.assignMenuRequired"), 400),
    );
  }

  // Check if menus are valid
  const invalidMenu = menus.find(
    (menuId) => !mongoose.Types.ObjectId.isValid(menuId),
  );
  if (invalidMenu) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.invalidObjectId"), 400),
    );
  }

  // Check if weekPlan exists
  const weekPlan = await WeekPlan.findOne({
    user: req.user._id,
    _id: id,
  });

  // If week plan is not found, return not found
  if (!weekPlan) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.weekPlanNotFound"), 400),
    );
  }

  // Process assign menu and check if menu is already assigned
  menus.forEach((menuId) => {
    if (
      !weekPlan.assignMenu.find(
        (assigned) => assigned.menu.toString() === menuId,
      )
    ) {
      weekPlan.assignMenu.push({ menu: menuId });
    }
  });

  // Save week plan
  await weekPlan.save();

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("weekPlan:messages.weekPlanUpdated"),
  });
});

/**
 * Delete assigned menu from week plan
 */

exports.deleteAssignedMenu = catchAsync(async (req, res, next) => {
  const { menuId, year, week } = req.query;

  // Check if id is valid
  if (!mongoose.Types.ObjectId.isValid(menuId)) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.invalidObjectId"), 400),
    );
  }

  // Check if year and week are provided
  if (!year || !week) {
    return next(
      new AppError(
        req.t("weekPlan:validationErrors.yearAndWeekNumberIsNotProvided"),
        400,
      ),
    );
  }

  // Check if weekPlan exists
  const weekPlan = await WeekPlan.findOne({
    user: req.user._id,
    year: parseInt(year),
    weekNumber: parseInt(week),
  });

  // If week plan is not found, return not found
  if (!weekPlan) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.weekPlanNotFound"), 400),
    );
  }

  // Check if menu is assigned
  const assignedMenu = weekPlan.assignMenu.find(
    (assigned) => assigned._id.toString() === menuId,
  );

  if (!assignedMenu) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.menuNotAssigned"), 400),
    );
  }

  // Check if menu is published
  if (assignedMenu.published) {
    return next(
      new AppError(
        req.t("weekPlan:validationErrors.menuPublishedAndCanNotBeDeleted"),
        400,
      ),
    );
  }

  // Remove menu from week plan
  weekPlan.assignMenu = weekPlan.assignMenu.filter(
    (assigned) => assigned._id.toString() !== menuId,
  );

  // Save week plan
  await weekPlan.save();

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("weekPlan:messages.menuDeleted"),
  });
});

/**
 * Manage publish week plan
 */
exports.managePublishMenu = catchAsync(async (req, res, next) => {
  const { year, week, menuId, publish } = req.body;

  // Check if year, week, menuId and publish are provided
  if (!year || !week || !menuId || typeof publish !== "boolean") {
    return next(
      new AppError(
        req.t("weekPlan:validationErrors.weekPlanMenuPublishFieldsAreRequired"),
        400,
      ),
    );
  }

  // Find week plan
  const weekPlan = await WeekPlan.findOne({
    user: req.user._id,
    year: parseInt(year),
    weekNumber: parseInt(week),
  });

  if (!weekPlan) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.weekPlanNotFound"), 400),
    );
  }

  // Check if menu is assigned
  const assignedMenu = weekPlan.assignMenu.find(
    (assigned) => assigned._id.toString() === menuId,
  );

  if (!assignedMenu) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.menuNotAssigned"), 400),
    );
  }

  // Check if menu is already published or  unpublished
  if (assignedMenu.published === publish) {
    return next(
      new AppError(
        `Week plan is already ${publish ? "published" : "unpublished"}.`,
        400,
      ),
    );
  }

  // Toogle publish status
  assignedMenu.published = publish;
  await weekPlan.save();

  // Perform publish or unpublish action
  if (publish) {
    // Perfom publish action
  } else {
    // Perform unpublish action
  }

  // Send response
  res.status(200).json({
    status: "success",
    message: publish
      ? req.t("weekPlan:messages.menuPublished")
      : req.t("weekPlan:messages.menuUnpublished"),
  });

  //
});

/**
 * Assign client to week plan
 */
exports.assignClient = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { menuId, clientId } = req.body;

  const weekPlan = await WeekPlan.findById(id);
  if (!weekPlan) {
    return res.status(404).json({ message: "Week Plan not found" });
  }

  weekPlan.assignMenu.forEach((menu) => {
    if (menu.menu === menuId) {
      menu.assignedClients.push(clientId);
    }
  });

  await weekPlan.save();

  res.status(200).json({ message: "Client assigned successfully", weekPlan });
});

/**
 * Assign group to week plan
 */
exports.assignGroup = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { menuId, groupId } = req.body;

  const weekPlan = await WeekPlan.findById(id);
  if (!weekPlan) {
    return res.status(404).json({ message: "Week Plan not found" });
  }

  weekPlan.assignMenu.forEach((menu) => {
    if (menu.menu === menuId) {
      menu.assignedGroups.push(groupId);
    }
  });

  await weekPlan.save();

  res.status(200).json({ message: "Group assigned successfully", weekPlan });
});
