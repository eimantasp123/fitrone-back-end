const WeeklyPlan = require("../models/WeeklyPlan");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { default: mongoose } = require("mongoose");
const WeeklyMenu = require("../models/WeeklyMenu");
const Customer = require("../models/Customer");
const { transformToUppercaseFirstLetter } = require("../utils/generalHelpers");
const {
  publishOrders,
  unpublishOrders,
} = require("../utils/publishAndUnpublishOrders");
const SingleDayOrder = require("../models/SingleDayOrder");
const { isWeekExpired } = require("../helper/dataHelpers");
const { getISOWeek } = require("date-fns/getISOWeek");
const { getYear } = require("date-fns/getYear");
const { toZonedTime } = require("date-fns-tz");
const { sendMessageToClients } = require("../utils/websocket");
/**
 * Set user timezone
 */
exports.setUserTimezone = catchAsync(async (req, res, next) => {
  const { timezone } = req.body;
  // Check if timezone is provided
  if (!timezone) {
    return next(
      new AppError(req.t("weeklyPlan:validationErrors.timezoneRequired"), 400),
    );
  }

  // Update user timezone
  req.user.timezone = timezone;
  await req.user.save();

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("weeklyPlan:messages.timezoneSetSuccess"),
    data: {
      timezone: req.user.timezone,
    },
  });
});

/**
 * Get weekly plan by date
 */
exports.getWeeklyPlanByDateAndCreate = catchAsync(async (req, res, next) => {
  const { year, week } = req.query;

  // Check if year and week are provided
  if (!year || !week) {
    return next(
      new AppError(
        req.t("weeklyPlan:validationErrors.yearAndWeekNumberIsNotProvided"),
        400,
      ),
    );
  }

  // Find weekly plan for the user with the provided year and week
  let weeklyPlan = await WeeklyPlan.findOne({
    user: req.user._id,
    year: parseInt(year),
    weekNumber: parseInt(week),
  }).populate([
    {
      path: "assignMenu.menu",
      select: "title description preferences restrictions",
    },
  ]);

  // If weekly plan is not found and timezone is set, create a new weekly plan
  if (!weeklyPlan && req.user.timezone) {
    // Check if week is expired
    const isExpired = isWeekExpired(year, week, req.user.timezone);

    if (isExpired) {
      return res.status(200).json({
        status: "expired_week",
        message: req.t("weeklyPlan:weekInPast"),
      });
    }

    // Create a new weekly plan
    weeklyPlan = await WeeklyPlan.create({
      user: req.user._id,
      year: parseInt(year),
      weekNumber: parseInt(week),
      timezone: req.user.timezone,
      status: "active",
    });

    // If weekly plan is not found and timezone is not set, return not found with empty data
  } else if (!weeklyPlan && !req.user.timezone) {
    return res.status(200).json({
      status: "not_found",
      data: [],
    });
  }

  // Response body
  const responseBody = {
    status: "success",
    timezone: req.user.timezone,
  };

  // If weekly plan is expired and isSnapshot, refactor assignMenu
  if (weeklyPlan.status === "expired" && weeklyPlan.isSnapshot) {
    const refactoredWeeklyPlanAssignMenu = weeklyPlan.assignMenu.map(
      (menu) => ({
        ...menu.toObject(),
        menuSnapshot: true,
        menu: menu.menuSnapshot
          ? {
              _id: menu.menuSnapshot._id,
              title: menu.menuSnapshot.title,
              description: menu.menuSnapshot.description,
              preferences: menu.menuSnapshot.preferences,
              restrictions: menu.menuSnapshot.restrictions,
            }
          : menu.menu,
      }),
    );
    responseBody.data = {
      ...weeklyPlan.toObject(),
      assignMenu: refactoredWeeklyPlanAssignMenu,
    };
  } else {
    responseBody.data = weeklyPlan;
  }

  // Ensure responseBody.data is always initialized
  responseBody.data = responseBody.data || { assignMenu: [] };

  // Send response
  res.status(200).json(responseBody);
});

/**
 * Create a new weekly plan for the user
 */
exports.assignMenu = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { menus } = req.body;

  // Check if id is valid
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(
      new AppError(req.t("weeklyPlan:validationErrors.invalidObjectId"), 400),
    );
  }

  // Check if assignMenu is provided
  if (!menus || !Array.isArray(menus)) {
    return next(
      new AppError(
        req.t("weeklyPlan:validationErrors.assignMenuRequired"),
        400,
      ),
    );
  }

  // Check if menus are valid
  const invalidMenu = menus.find(
    (menuId) => !mongoose.Types.ObjectId.isValid(menuId),
  );
  if (invalidMenu) {
    return next(
      new AppError(req.t("weeklyPlan:validationErrors.invalidObjectId"), 400),
    );
  }

  // Check if weekPlan exists
  const weeklyPlan = await WeeklyPlan.findOne({
    user: req.user._id,
    status: "active",
    _id: id,
  });

  // If week plan is not found, return not found
  if (!weeklyPlan) {
    return next(
      new AppError(
        req.t("weeklyPlan:validationErrors.weeklyPlanNotFound"),
        400,
      ),
    );
  }

  // Process assign menu and check if menu is already assigned
  for (const menuId of menus) {
    if (
      !weeklyPlan.assignMenu.find(
        (assigned) => assigned.menu.toString() === menuId,
      )
    ) {
      weeklyPlan.assignMenu.push({ menu: menuId });

      // Assign weekly plan to weekly menu
      try {
        await WeeklyMenu.findOneAndUpdate(
          {
            _id: menuId,
            activeWeeks: {
              $not: {
                $elemMatch: {
                  year: weeklyPlan.year,
                  weekNumber: weeklyPlan.weekNumber,
                },
              },
            },
          },
          {
            $push: {
              activeWeeks: {
                year: weeklyPlan.year,
                weekNumber: weeklyPlan.weekNumber,
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
  await weeklyPlan.save();

  // Response body
  const responseBody = {
    status: "success",
    message: req.t("weeklyPlan:messages.weeklyPlanUpdated"),
  };

  // Add warning if any warning is set
  if (req.warning) {
    responseBody.warning = req.warning;
  }

  // Add warning if any warning is set for multiple menus
  if (req.warning_multiple) {
    responseBody.warning_multiple = req.warning_multiple;
  }

  // Send response
  res.status(200).json(responseBody);
});

/**
 * Delete assigned menu from weekly plan
 */

exports.deleteAssignedMenu = catchAsync(async (req, res, next) => {
  const { menuId, year, week } = req.query;

  // Check if id is valid
  if (!mongoose.Types.ObjectId.isValid(menuId)) {
    return next(
      new AppError(req.t("weeklyPlan:validationErrors.invalidObjectId"), 400),
    );
  }

  // Check if year and week are provided
  if (!year || !week) {
    return next(
      new AppError(
        req.t("weeklyPlan:validationErrors.yearAndWeekNumberIsNotProvided"),
        400,
      ),
    );
  }

  // Check if weeklyPlan exists
  const weeklyPlan = await WeeklyPlan.findOne({
    user: req.user._id,
    status: "active",
    year: parseInt(year),
    weekNumber: parseInt(week),
  });

  // If weekly plan is not found, return not found
  if (!weeklyPlan) {
    return next(
      new AppError(
        req.t("weeklyPlan:validationErrors.weeklyPlanNotFound"),
        400,
      ),
    );
  }

  // Check if menu is assigned
  const assignedMenu = weeklyPlan.assignMenu.find(
    (assigned) => assigned._id.toString() === menuId,
  );

  if (!assignedMenu) {
    return next(
      new AppError(req.t("weeklyPlan:validationErrors.menuNotAssigned"), 400),
    );
  }

  // Check if menu is published
  if (assignedMenu.published) {
    return next(
      new AppError(
        req.t("weeklyPlan:validationErrors.menuPublishedAndCanNotBeDeleted"),
        400,
      ),
    );
  }

  // Remove menu from weekly plan
  weeklyPlan.assignMenu = weeklyPlan.assignMenu.filter(
    (assigned) => assigned._id.toString() !== menuId,
  );

  // Remove weekly plan reference from activeWeeks
  await WeeklyMenu.updateOne(
    { _id: assignedMenu.menu },
    {
      $pull: {
        activeWeeks: {
          year: weeklyPlan.year,
          weekNumber: weeklyPlan.weekNumber,
        },
      },
    },
  );

  // If activeWeeks is now empty, set status to "inactive"
  await WeeklyMenu.updateOne(
    { _id: assignedMenu.menu, activeWeeks: { $size: 0 } }, // Only update if array is now empty
    { $set: { status: "inactive" } },
  );

  // Save week plan
  await weeklyPlan.save();

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("weeklyPlan:messages.menuDeleted"),
  });
});

/**
 * Manage publish weekly plan
 */
exports.managePublishMenu = catchAsync(async (req, res, next) => {
  const { year, week, menuId, publish } = req.body;

  // Check if year, week, menuId and publish are provided
  if (!year || !week || !menuId || typeof publish !== "boolean") {
    return next(
      new AppError(
        req.t(
          "weeklyPlan:validationErrors.weeklyPlanMenuPublishFieldsAreRequired",
        ),
        400,
      ),
    );
  }

  // Find weekly plan
  const weeklyPlan = await WeeklyPlan.findOne({
    user: req.user._id,
    status: "active",
    year: parseInt(year),
    weekNumber: parseInt(week),
  }).populate({
    path: "assignMenu.menu",
  });

  if (!weeklyPlan) {
    return next(
      new AppError(
        req.t("weeklyPlan:validationErrors.weeklyPlanNotFound"),
        400,
      ),
    );
  }

  // Check if menu is assigned
  const assignedWeeklyMenu = weeklyPlan.assignMenu.find(
    (assigned) => assigned._id.toString() === menuId,
  );

  if (!assignedWeeklyMenu) {
    return next(
      new AppError(req.t("weeklyPlan:validationErrors.menuNotAssigned"), 400),
    );
  }

  // Check if menu is already published or  unpublished
  if (assignedWeeklyMenu.published === publish) {
    return next(
      new AppError(
        `Week plan is already ${publish ? "published" : "unpublished"}.`,
        400,
      ),
    );
  }

  // Check does weekly plan has any clients assigned
  if (assignedWeeklyMenu.assignedClients.length === 0) {
    return res.status(200).json({
      status: "warning",
      message: req.t("weeklyPlan:validationErrors.noClientsAssigned"),
    });
  }

  // Check if single day order for current week is already published
  const singleDayOrders = await SingleDayOrder.find({
    user: req.user._id,
    year: parseInt(year),
    weekNumber: parseInt(week),
  });

  // If orders are created for the week, check if they are already started
  if (singleDayOrders.length > 0) {
    for (const day of assignedWeeklyMenu.menu.days) {
      // Check if meals are already created for the day
      if (day.meals.length !== 0) {
        // Find single day order for the day
        const singleDayOrder = singleDayOrders.find(
          (order) => order.day === day.day,
        );

        // If single day order is done, prevent publish action
        if (singleDayOrder && singleDayOrder.status === "done") {
          return res.status(200).json({
            status: "warning",
            message: publish
              ? req.t(
                  "weeklyPlan:validationErrors.ordersAlreadyStarted_publish",
                )
              : req.t(
                  "weeklyPlan:validationErrors.ordersAlreadyStarted_unpublish",
                ),
          });
        }
      }
    }
  }

  // Perform publish or unpublish action
  if (publish) {
    // Perfom publish action
    publishOrders(
      req,
      singleDayOrders,
      assignedWeeklyMenu,
      parseInt(year),
      parseInt(week),
    );
  } else {
    // Perform unpublish action
    unpublishOrders(
      req,
      singleDayOrders,
      assignedWeeklyMenu,
      parseInt(year),
      parseInt(week),
    );
  }

  // Toogle publish status
  assignedWeeklyMenu.published = publish;
  await weeklyPlan.save();

  // Send response
  res.status(200).json({
    status: "success",
    message: publish
      ? req.t("weeklyPlan:messages.menuPublished")
      : req.t("weeklyPlan:messages.menuUnpublished"),
  });
});

/**
 * Get weekly plan assigned menu client and group details
 */
exports.getWeeklyPlanAssignedMenuDetails = catchAsync(
  async (req, res, next) => {
    const { id, menuId } = req.params;

    // Check if week plan id is valid
    const weeklyPlan = await WeeklyPlan.findOne(
      {
        user: req.user._id,
        _id: id,
        "assignMenu.menu": menuId,
      },
      { "assignMenu.$": 1, status: 1 },
    ).populate({
      path: "assignMenu.assignedClients",
      select: "+firstName +lastName +email",
    });

    if (!weeklyPlan) {
      return next(
        new AppError(
          req.t(
            "weeklyPlan:validationErrors.weeklyPlanNotFoundOrMenuIsNotAssigned",
          ),
          400,
        ),
      );
    }

    // Determine if the weekly plan is expired
    const isExpired = weeklyPlan.status === "expired";

    // Prepare the response data
    const responseData = {
      weekPlanId: weeklyPlan._id,
      expired: isExpired, // Add `expired: true` if the plan is expired
      menuDetails: {
        menu: weeklyPlan.assignMenu[0].menu,
        published: weeklyPlan.assignMenu[0].published,
        assignedClients: weeklyPlan.assignMenu[0].assignedClients,
      },
    };

    res.status(200).json({
      status: "success",
      data: responseData,
    });
  },
);

/**
 * Assign client to weekly plan menu
 */
exports.assignClients = catchAsync(async (req, res, next) => {
  const { weeklyPlan, weeklyMenu } = req;
  const { clients } = req.body;

  // Check if clients are provided
  if (!clients || !Array.isArray(clients) || clients.length === 0) {
    return next(
      new AppError(req.t("weeklyPlan:validationErrors.clientsRequired"), 400),
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
      new AppError(req.t("weeklyPlan:validationErrors.invalidClients"), 400),
    );
  }

  // Check if clients are already assigned to weekly plan menu
  const assignedClientsResponse = [];
  //
  clientsDB.forEach((client) => {
    let assignedCount = 0;

    weeklyPlan.assignMenu.forEach((menu) => {
      // Count how many times the client is already assigned
      assignedCount += menu.assignedClients.filter((_id) =>
        _id.equals(client._id),
      ).length;
    });

    // If customer has already been assigned to the max quantity, prevent further assignments
    if (assignedCount >= client.weeklyMenuQuantity) {
      assignedClientsResponse.push({
        firstName: client.firstName,
        lastName: client.lastName,
        menuQuantity: client.weeklyMenuQuantity,
      });
    }
  });

  // If clients are already assigned to weekly plan menu, return error
  if (assignedClientsResponse.length > 0) {
    const message = assignedClientsResponse
      .map((client) => {
        return req.t("weeklyPlan:validationErrors.clientAssigned", {
          client: `${transformToUppercaseFirstLetter(client.firstName)} ${transformToUppercaseFirstLetter(client.lastName)}`,
          menuQuantity: client.menuQuantity,
        });
      })
      .join(" ");

    return res.status(200).json({
      status: "warning",
      message: req.t("weeklyPlan:validationErrors.clientsAlreadyAssigned", {
        clients: message,
      }),
    });
  }

  // Assign clients to week plan
  weeklyPlan.assignMenu.forEach((menu) => {
    if (menu.menu._id.toString() === weeklyMenu._id.toString()) {
      menu.assignedClients.push(...clients);
    }
  });

  await weeklyPlan.save();

  // Send response
  res.status(200).json({
    status: "success",
    message:
      clients.length > 1
        ? req.t("weeklyPlan:messages.clientsAssigned")
        : req.t("weeklyPlan:messages.clientAssigned"),
  });
});

/**
 * Remove client from weekly plan menu
 */
exports.removeClient = catchAsync(async (req, res, next) => {
  const { weeklyPlan, weeklyMenu } = req;
  const { clientId } = req.body;

  // Check if client is provided
  if (!clientId) {
    return next(
      new AppError(req.t("weeklyPlan:validationErrors.clientRequired"), 400),
    );
  }

  // Check if client exists
  const client = await Customer.findOne({
    supplier: req.user._id,
    _id: clientId,
  });

  if (!client) {
    return next(
      new AppError(req.t("weeklyPlan:validationErrors.invalidClient"), 400),
    );
  }

  let found = false;

  // Iterate through weekly plan menus
  weeklyPlan.assignMenu.forEach((menu) => {
    if (menu.menu._id.toString() === weeklyMenu._id.toString()) {
      const index = menu.assignedClients.findIndex((_id) =>
        _id.equals(client._id),
      );
      if (index !== -1) {
        menu.assignedClients.splice(index, 1);
        found = true;
      }
    }
  });

  if (!found) {
    return next(
      new AppError(req.t("weeklyPlan:validationErrors.clientNotAssigned"), 400),
    );
  }

  // Save weekly plan
  await weeklyPlan.save();

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("weeklyPlan:messages.clientRemoved"),
  });
});

/**
 * Middleware to check if weekly plan menu is assigned
 */
exports.checkWeeklyPlanAndMenuAssigned = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { menuId } = req.body;

  // Check if week plan id is valid
  const weeklyPlan = await WeeklyPlan.findOne({
    user: req.user._id,
    _id: id,
    status: "active",
  }).populate([
    { path: "assignMenu.menu", select: "title" },
    {
      path: "assignMenu.assignedClients",
      select: "+firstName +lastName +email",
    },
  ]);

  if (!weeklyPlan) {
    return next(
      new AppError(
        req.t("weeklyPlan:validationErrors.weeklyPlanNotFound"),
        400,
      ),
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
  const menuNotExists = weeklyPlan.assignMenu.find(
    (menu) => menu.menu._id.toString() === menuId.toString(),
  );

  if (!menuNotExists) {
    return next(
      new AppError(req.t("weeklyPlan:validationErrors.menuNotAssigned"), 400),
    );
  }

  if (menuNotExists.published) {
    return res.status(200).json({
      status: "warning",
      message: req.t("weeklyPlan:validationErrors.menuPublished"),
    });
  }

  req.weeklyPlan = weeklyPlan;
  req.weeklyMenu = weeklyMenu;
  next();
});

/**
 * Expire a single Weekly Plan manually
 */
exports.expireWeeklyPlan = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Find the weekly plan with populated menus
  const weeklyPlan = await WeeklyPlan.findOne({
    _id: id,
    user: req.user._id,
    status: "active", // Only active plans can be expired
  }).populate({
    path: "assignMenu.menu",
  });

  if (!weeklyPlan) {
    return next(
      new AppError(
        req.t("weeklyPlan:validationErrors.weeklyPlanNotFound"),
        404,
      ),
    );
  }
  // Check does weekly plan have asigned menus or some asigned menu is not published
  if (
    weeklyPlan.assignMenu.length === 0 ||
    weeklyPlan.assignMenu.some((menu) => !menu.published)
  ) {
    sendMessageToClients(req.user._id, "weeklyPlanExpired");
    return res.status(200).json({
      status: "warning",
      message: req.t("weeklyPlan:validationErrors.menuNotPublished"),
    });
  }

  // Get the current date and user's timezone
  const now = new Date();
  const userTimezone = req.user.timezone || "UTC"; // fallback just in case

  // Convert to user's local time
  const userNow = toZonedTime(now, userTimezone);
  const userCurrentWeek = getISOWeek(userNow);
  const userCurrentYear = getYear(userNow);

  // Optional: disallow expiring if plan is not current week
  if (
    weeklyPlan.year !== userCurrentYear ||
    weeklyPlan.weekNumber !== userCurrentWeek
  ) {
    sendMessageToClients(req.user._id, "weeklyPlanExpired");
    return next(
      new AppError(
        req.t("weeklyPlan:validationErrors.cannotExpireThisWeek"),
        400,
      ),
    );
  }

  // Snapshot each assigned menu
  weeklyPlan.assignMenu.forEach((menuItem) => {
    if (menuItem.menu) {
      menuItem.menuSnapshot = JSON.parse(JSON.stringify(menuItem.menu)); // Deep Copy
    }
  });

  weeklyPlan.status = "expired";
  weeklyPlan.isSnapshot = true;
  await weeklyPlan.save({ validateBeforeSave: true }); // Save updated snapshot

  // Find all single day orders for the expired
  const singleDayOrders = await SingleDayOrder.find({
    user: req.user._id,
    weekNumber: weeklyPlan.weekNumber,
    year: weeklyPlan.year,
    expired: false,
  });

  // Update single day orders
  for (const singleDayOrder of singleDayOrders) {
    singleDayOrder.categories = singleDayOrder.categories.map((category) => {
      return {
        ...category,
        meals: category.meals.map((meal) => {
          return {
            ...meal,
            status: "done",
            weeklyMenuTitle: meal.weeklyMenu.title,
          };
        }),
      };
    });

    singleDayOrder.expired = true;
    singleDayOrder.status = "done";

    // Save the updated single day order
    await singleDayOrder.save({ validateBeforeSave: true });
  }

  // Clean up activeWeeks in WeeklyMenus
  await WeeklyMenu.updateMany(
    {
      user: req.user._id,
      "activeWeeks.year": weeklyPlan.year,
      "activeWeeks.weekNumber": weeklyPlan.weekNumber,
    },
    {
      $pull: {
        activeWeeks: {
          year: weeklyPlan.year,
          weekNumber: weeklyPlan.weekNumber,
        },
      },
    },
  );

  // Mark any WeeklyMenus with empty activeWeeks as inactive
  await WeeklyMenu.updateMany(
    {
      user: req.user._id,
      activeWeeks: { $size: 0 },
    },
    { $set: { status: "inactive" } },
  );

  // Format single day orders ids for response
  const singleDayOrderIds = singleDayOrders.map((order) => order._id);

  // Send message to client
  sendMessageToClients(req.user._id, "weeklyPlanExpired");

  // Send response
  return res.status(200).json({
    status: "success",
    message: req.t("weeklyPlan:messages.weeklyPlanExpired"),
    data: {
      weeklyPlanId: weeklyPlan._id,
      singleDayOrderIds,
    },
  });
});
