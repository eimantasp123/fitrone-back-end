const WeekPlan = require("../models/WeekPlan");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const _ = require("lodash");
const { default: mongoose } = require("mongoose");
const { setYear, setWeek } = require("date-fns");
const { toZonedTime } = require("date-fns-tz");
const WeeklyMenu = require("../models/WeeklyMenu");
const Customer = require("../models/Customer");
const Group = require("../models/Group");
const { transformToUppercaseFirstLetter } = require("../utils/generalHelpers");
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
  }).populate([
    {
      path: "assignMenu.menu",
      select: "title description preferences restrictions",
    },
    {
      path: "assignMenu.assignedClients",
      select: "firstName lastName email",
    },
    { path: "assignMenu.assignedGroups", select: "title members" },
  ]);

  // If week plan is not found and timezone is set, create a new week plan
  if (!weekPlan && req.user.timezone) {
    // Check current year and week for user timezone
    const serverDate = toZonedTime(new Date(), req.user.timezone);

    // Get client date
    let clientDate = setYear(new Date(serverDate), parseInt(year));
    clientDate = setWeek(clientDate, parseInt(week));

    weekPlan = await WeekPlan.create({
      user: req.user._id,
      year: parseInt(year),
      status: clientDate >= serverDate ? "active" : "expired", // If week is in the past, set status to expired
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

  console.log("req.body", req.body.menus);

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
    status: "active",
    _id: id,
  });

  // If week plan is not found, return not found
  if (!weekPlan) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.weekPlanNotFound"), 400),
    );
  }

  // Process assign menu and check if menu is already assigned
  for (const menuId of menus) {
    if (
      !weekPlan.assignMenu.find(
        (assigned) => assigned.menu.toString() === menuId,
      )
    ) {
      weekPlan.assignMenu.push({ menu: menuId });

      // Assign week plan to weekly menu
      try {
        await WeeklyMenu.findOneAndUpdate(
          {
            _id: menuId,
            activeWeeks: {
              $not: {
                $elemMatch: {
                  year: weekPlan.year,
                  weekNumber: weekPlan.weekNumber,
                },
              },
            },
          },
          {
            $push: {
              activeWeeks: {
                year: weekPlan.year,
                weekNumber: weekPlan.weekNumber,
              },
            },
            $set: { status: "active" },
          },
          { new: true },
        );
      } catch (error) {
        return next(
          new AppError(req.t("weeklyMenu:errors.weeklyMenuNotFound"), 404),
        );
      }
    }
  }

  // Save week plan
  await weekPlan.save();

  // Response body
  const responseBody = {
    status: "success",
    message: req.t("weekPlan:messages.weekPlanUpdated"),
  };

  console.log("req", req.warning);
  // Add warning if any warning is set
  if (req.warning) {
    console.log("req.warning", req.warning);
    responseBody.warning = req.warning;
  }

  // Add warning if any warning is set for multiple menus
  if (req.warning_multiple) {
    console.log("req.warning_multiple", req.warning_multiple);
    responseBody.warning_multiple = req.warning_multiple;
  }

  // Send response
  res.status(200).json(responseBody);
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
    status: "active",
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

  // Remove week plan reference from activeWeeks
  await WeeklyMenu.updateOne(
    { _id: assignedMenu.menu },
    {
      $pull: {
        activeWeeks: { year: weekPlan.year, weekNumber: weekPlan.weekNumber },
      },
    },
  );

  // If activeWeeks is now empty, set status to "inactive"
  await WeeklyMenu.updateOne(
    { _id: assignedMenu.menu, activeWeeks: { $size: 0 } }, // Only update if array is now empty
    { $set: { status: "inactive" } },
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
    status: "active",
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
 * Get week plan assigned menu client and group details
 */
exports.getWeekPlanAssignedMenuDetails = catchAsync(async (req, res, next) => {
  const { id, menuId } = req.params;

  // Check if week plan id is valid
  const weekPlan = await WeekPlan.findOne(
    {
      user: req.user._id,
      _id: id,
      status: "active",
      "assignMenu.menu": menuId,
    },
    { "assignMenu.$": 1 },
  ).populate([
    {
      path: "assignMenu.assignedGroups",
      select: "title createdAt",
    },
    {
      path: "assignMenu.assignedClients",
      select: "firstName lastName email",
    },
  ]);

  if (!weekPlan) {
    return next(
      new AppError(
        req.t("weekPlan:validationErrors.weekPlanNotFoundOrMenuIsNotAssigned"),
        400,
      ),
    );
  }

  res.status(200).json({
    status: "success",
    data: {
      weekPlanId: weekPlan._id,
      menuDetails: weekPlan.assignMenu[0],
    },
  });
});

/**
 * Assign client to week plan menu
 */
exports.assignClients = catchAsync(async (req, res, next) => {
  const { weekPlan, weeklyMenu } = req;
  const { clients } = req.body;

  // Check if clients are provided
  if (!clients || !Array.isArray(clients) || clients.length === 0) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.clientsRequired"), 400),
    );
  }

  // Find does all clients exists
  const clientsDB = await Customer.find({
    supplier: req.user._id,
    _id: { $in: clients },
  });

  // Check if all clients exists
  if (clientsDB.length !== clients.length) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.invalidClients"), 400),
    );
  }

  // Check if clients are already assigned to week plan menu
  const assignedClientsResponse = [];
  clientsDB.map((client) => {
    for (const menu of weekPlan.assignMenu) {
      if (menu.assignedClients.some((id) => id.equals(client._id))) {
        assignedClientsResponse.push({
          firstName: client.firstName,
          lastName: client.lastName,
          menu: menu.menu.title,
        });
      }
    }
  });

  console.log("clientsDB", clientsDB);

  // If clients are already assigned to week plan menu, return error
  if (assignedClientsResponse.length > 0) {
    console.log("assignedClientsResponse", assignedClientsResponse);

    const message = assignedClientsResponse
      .map((client) => {
        return req.t("weekPlan:validationErrors.clientAssigned", {
          client: `${transformToUppercaseFirstLetter(client.firstName)} ${transformToUppercaseFirstLetter(client.lastName)}`,
          menu: client.menu,
        });
      })
      .join(" ");

    return res.status(200).json({
      status: "warning",
      message: req.t("weekPlan:validationErrors.clientsAlreadyAssigned", {
        clients: message,
      }),
    });
  }

  // Check if clients are assigned to week plan menu or other menus with group assigned
  const alreadyAssignedGroupMembers = [];
  clientsDB.map((client) => {
    for (const menu of weekPlan.assignMenu) {
      if (
        menu.assignedGroups.length > 0 &&
        menu.assignedGroups.some((group) =>
          group.members.some((_id) => _id.equals(client._id)),
        )
      ) {
        alreadyAssignedGroupMembers.push({
          firstName: client.firstName,
          lastName: client.lastName,
          group: menu.assignedGroups.find((group) =>
            group.members.some((_id) => _id.equals(client._id)),
          ).title,
          menu: menu.menu.title,
        });
      }
    }
  });

  // If clients are already assigned to week plan menu, return error
  if (alreadyAssignedGroupMembers.length > 0) {
    console.log("alreadyAssignedGroupMembers", alreadyAssignedGroupMembers);

    const message = alreadyAssignedGroupMembers
      .map((client) => {
        return req.t("weekPlan:validationErrors.clientAssignedToGroup", {
          client: `${transformToUppercaseFirstLetter(client.firstName)} ${transformToUppercaseFirstLetter(client.lastName)}`,
          group: client.group,
        });
      })
      .join(" ");

    console.log("message", message);

    return res.status(200).json({
      status: "warning",
      message: req.t("weekPlan:validationErrors.clientsAlreadyAssigned", {
        clients: message,
      }),
    });
  }

  // Assign clients to week plan
  weekPlan.assignMenu.forEach((menu) => {
    if (menu.menu._id.toString() === weeklyMenu._id.toString()) {
      console.log("push client to menu", weeklyMenu._id);
      menu.assignedClients.push(...clients);
    }
  });

  await weekPlan.save();

  // Send response
  res.status(200).json({
    status: "success",
    message:
      clients.length > 1
        ? req.t("weekPlan:messages.clientsAssigned")
        : req.t("weekPlan:messages.clientAssigned"),
  });
});

/**
 * Remove client from week plan menu
 */
exports.removeClient = catchAsync(async (req, res, next) => {
  const { weekPlan, weeklyMenu } = req;
  const { clientId } = req.body;

  // Check if client is provided
  if (!clientId) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.clientRequired"), 400),
    );
  }

  // Check if client exists
  const client = await Customer.findOne({
    supplier: req.user._id,
    _id: clientId,
  });

  if (!client) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.invalidClient"), 400),
    );
  }

  // Check if client is assigned to week plan menu
  const clientNotAssigned = weekPlan.assignMenu.find((menu) =>
    menu.assignedClients.some((id) => id.equals(client._id)),
  );

  if (!clientNotAssigned) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.clientNotAssigned"), 400),
    );
  }

  // Remove client from week plan
  weekPlan.assignMenu.forEach((menu) => {
    if (menu.menu._id.toString() === weeklyMenu._id.toString()) {
      menu.assignedClients = menu.assignedClients.filter(
        (id) => !id.equals(client._id),
      );
    }
  });

  await weekPlan.save();

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("weekPlan:messages.clientRemoved"),
  });
});

/**
 * Assign group to week plan menu
 */
exports.assignGroup = catchAsync(async (req, res, next) => {
  const { weekPlan, weeklyMenu, group } = req;

  // Check if group is already assigned to current week plan menu
  const groupAlreadyAssignedOnCurrentMenu = weekPlan.assignMenu.find(
    (menu) =>
      menu.menu._id.equals(weeklyMenu._id) &&
      menu.assignedGroups.some((_id) => _id.equals(group._id)),
  );

  if (groupAlreadyAssignedOnCurrentMenu) {
    return next(
      new AppError(
        req.t("weekPlan:validationErrors.groupAlreadyAssignedOnCurrentMenu"),
        400,
      ),
    );
  }

  // Check if group is already assigned to other week plan menu
  const assignedGroup = weekPlan.assignMenu.find((menu) =>
    menu.assignedGroups.some((_id) => _id.equals(group._id)),
  );

  if (assignedGroup) {
    return next(
      new AppError(
        req.t("weekPlan:validationErrors.groupAlreadyAssigned", {
          group: assignedGroup.menu.title,
        }),
        400,
      ),
    );
  }

  // Check if clients are already assigned to week plan menu
  const clientAlreadyAssigned = [];
  group.members.forEach((member) => {
    for (const menu of weekPlan.assignMenu) {
      if (
        menu.assignedClients.some((client) => client._id.equals(member._id))
      ) {
        clientAlreadyAssigned.push({
          firstName: member.firstName,
          lastName: member.lastName,
          menu: menu.menu.title,
        });
      }
    }
  });

  // If clients are already assigned to week plan menu, return error
  if (clientAlreadyAssigned.length > 0) {
    console.log("clientAlreadyAssigned", clientAlreadyAssigned);
    const message = clientAlreadyAssigned
      .map((client) => {
        return req.t("weekPlan:validationErrors.clientAssigned", {
          client: `${transformToUppercaseFirstLetter(client.firstName)} ${transformToUppercaseFirstLetter(client.lastName)}`,
          menu: client.menu,
        });
      })
      .join(" ");

    console.log("message", message);

    return res.status(200).json({
      status: "warning",
      message: req.t("weekPlan:validationErrors.clientsAlreadyAssigned", {
        clients: message,
      }),
    });
  }

  // Assign group to week plan
  weekPlan.assignMenu.forEach((menu) => {
    if (menu.menu._id.toString() === weeklyMenu._id.toString()) {
      menu.assignedGroups.push(group._id);
    }
  });

  await weekPlan.save();

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("weekPlan:messages.groupAssigned"),
  });
});

/**
 * Remove group from week plan menu
 */
exports.removeGroup = catchAsync(async (req, res, next) => {
  const { weekPlan, weeklyMenu, group } = req;

  // Check if group is assigned to week plan menu
  const groupNotAssigned = weekPlan.assignMenu.find((menu) =>
    menu.assignedGroups.some((_id) => _id.equals(group._id)),
  );

  if (!groupNotAssigned) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.groupNotAssigned"), 400),
    );
  }

  // Remove group from week plan
  weekPlan.assignMenu.forEach((menu) => {
    if (menu.menu._id.toString() === weeklyMenu._id.toString()) {
      menu.assignedGroups = menu.assignedGroups.filter(
        (id) => !id.equals(group._id),
      );
    }
  });

  await weekPlan.save();

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("weekPlan:messages.groupRemoved"),
  });
});

/**
 * Middleware to check if week plan menu is assigned
 */
exports.checkWeekPlanAndMenuAssigned = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { menuId, groupId } = req.body;

  // Check if week plan id is valid
  const weekPlan = await WeekPlan.findOne({
    user: req.user._id,
    _id: id,
    status: "active",
  }).populate([
    { path: "assignMenu.menu", select: "title" },
    { path: "assignMenu.assignedClients", select: "firstName lastName email" },
    {
      path: "assignMenu.assignedGroups",
      select: "title members",
      populate: { path: "members", select: "firstName lastName email" },
    },
  ]);

  if (!weekPlan) {
    return next(
      new AppError(req.t("weekPlan:validationErrors.weekPlanNotFound"), 400),
    );
  }

  // Check does weekly menu exists
  const weeklyMenu = await WeeklyMenu.findOne({
    user: req.user._id,
    _id: menuId,
  });

  if (!weeklyMenu) {
    return next(
      new AppError(req.t("weeklyMenu:errors.weeklyMenuNotFound"), 404),
    );
  }

  // Check if menu is assigned
  const menuNotExists = weekPlan.assignMenu.find(
    (menu) => menu.menu._id.toString() === menuId.toString(),
  );

  if (!menuNotExists) {
    console.log("menuNotExists", menuNotExists);
    return next(
      new AppError(req.t("weekPlan:validationErrors.menuNotAssigned"), 400),
    );
  }

  // If group is provided, check if group exists and is not already assigned
  if (groupId) {
    // Find does group exists
    const group = await Group.findOne({
      createdBy: req.user._id,
      _id: groupId,
    }).populate({
      path: "members",
      select: "firstName lastName email",
    });

    // Check if group exists
    if (!group) {
      return next(
        new AppError(req.t("weekPlan:validationErrors.invalidGroup"), 400),
      );
    }

    req.group = group;
  }

  req.weekPlan = weekPlan;
  req.weeklyMenu = weeklyMenu;
  next();
});
