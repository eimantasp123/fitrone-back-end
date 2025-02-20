const SingleDayOrder = require("../models/SingleDayOrder");
const WeeklyPlan = require("../models/WeeklyPlan");
const { sendMessageToClients } = require("./websocket");

/**
 * Publish weekly plan and create single day orders for each day of the week
 * @param {Request} req - Express request object
 * @param {Number} year - Year of the weekly plan
 * @param {Number} weekNumber - Week number of the weekly plan
 * @param {String} menuIdInWeeklyPlan - Menu document id in weekly plan (not weekly menu id)
 */
const publishOrders = async (req, year, weekNumber, menuIdInWeeklyPlan) => {
  try {
    // Get weekly plan details and single day orders
    const { weeklyPlanDetails, singleDayOrders } =
      await getWeeklyPlanDetailsAndOrders(
        req,
        year,
        weekNumber,
        menuIdInWeeklyPlan,
      );

    // If single day orders on current week are already published, update them with new weekly plan details
    if (singleDayOrders.length > 0) {
      // Map on each single day order
      for (const singleDayOrder of singleDayOrders) {
        // Create category map which will be used to organize meals by category
        const categoryMap = new Map();

        // Map for each meal in the day
        for (const meal of weeklyPlanDetails.menu.days[singleDayOrder.day]
          .meals) {
          const category = meal.category; // Get category of meal

          // Create category if it doesn't exist
          if (!categoryMap.has(category)) {
            categoryMap.set(category, {
              category,
              meals: [],
            });
          }

          // Add meal to category
          categoryMap.get(category).meals.push({
            meal: meal.meal,
            weeklyMenu: weeklyPlanDetails.menu._id,
            status: "not_done",
            customers: weeklyPlanDetails.assignedClients,
          });
        }

        // Map on each category of category map
        for (const category of Array.from(categoryMap.values())) {
          // Find category index in single day order
          const categoryIndex = singleDayOrder.categories.findIndex(
            (c) => c.category === category.category,
          );

          // If category already exists, merge meals
          if (categoryIndex !== -1) {
            singleDayOrder.categories[categoryIndex].meals.push(
              ...category.meals,
            );
          }

          // If category doesn't exist, add it
          if (categoryIndex === -1) {
            singleDayOrder.categories.push(category);
          }
        }
      }

      // Bulk update for each single day order with new categories and meals
      await SingleDayOrder.bulkWrite(
        singleDayOrders.map((order) => ({
          updateOne: {
            filter: { _id: order._id },
            update: { $set: { categories: order.categories } },
          },
        })),
      );

      // Send message to clients
      // sendMessageToClients(req.user._id, "singleDayOrders");

      console.log("publish updated weekly plan");
    } else {
      // Create new single day orders
      const newOrders = weeklyPlanDetails.menu.days.map((day) => {
        // Create category map which will be used to organize meals by category
        const categoryMap = new Map();

        // Map for each meal in the day
        for (const meal of day.meals) {
          const category = meal.category;

          // Create category if it doesn't exist
          if (!categoryMap.has(category)) {
            categoryMap.set(category, {
              category,
              meals: [],
            });
          }

          // Add meal to category
          categoryMap.get(category).meals.push({
            meal: meal.meal,
            weeklyMenu: weeklyPlanDetails.menu._id,
            status: "not_done",
            customers: weeklyPlanDetails.assignedClients,
          });
        }

        // Return single day order object
        return {
          user: req.user._id,
          year,
          weekNumber,
          day: day.day,
          categories: Array.from(categoryMap.values()),
        };
      });

      // Insert new single day orders
      await SingleDayOrder.insertMany(newOrders);

      // Send message to clients
      // sendMessageToClients(req.user._id, "singleDayOrders");
      console.log("publish new weekly plan");
    }
  } catch (error) {
    console.error("Error publishing orders:", error.message);
  }
};

/**
 * Unpublish weekly plan and remove meals from single day orders
 * @param {Request} req - Express request object
 * @param {Number} year - Year of the weekly plan
 * @param {Number} weekNumber - Week number of the weekly plan
 * @param {String} menuIdInWeeklyPlan - Menu document id in weekly plan (not weekly menu id)
 */
const unpublishOrders = async (req, year, weekNumber, menuIdInWeeklyPlan) => {
  try {
    // Get weekly plan details and single day orders
    const { weeklyPlanDetails, singleDayOrders } =
      await getWeeklyPlanDetailsAndOrders(
        req,
        year,
        weekNumber,
        menuIdInWeeklyPlan,
      );

    // Map on each single day order
    for (const singleDayOrder of singleDayOrders) {
      // Map on each category of single day order
      for (const category of singleDayOrder.categories) {
        // Filter out meals that belong to weekly menu
        category.meals = category.meals.filter(
          (meal) =>
            meal.weeklyMenu.toString() !==
            weeklyPlanDetails.menu._id.toString(),
        );

        // If meals are empty, remove category
        if (category.meals.length === 0) {
          singleDayOrder.categories = singleDayOrder.categories.filter(
            (c) => c.category !== category.category,
          );
        }
      }
    }

    // Bulk update for each single day order with new categories and meals
    await SingleDayOrder.bulkWrite(
      singleDayOrders.map((order) => ({
        updateOne: {
          filter: { _id: order._id },
          update: { $set: { categories: order.categories } },
        },
      })),
    );

    // Send message to clients
    // sendMessageToClients(req.user._id, "singleDayOrders");
    console.log("unpublish weekly plan");
  } catch (error) {
    console.error("Error unpublishing orders:", error.message);
  }
};

/**
 * Helper function to get weekly plan details and single day orders from request
 * @param {Request} req - Express request object
 * @param {Number} year - Year of the weekly plan
 * @param {Number} weekNumber - Week number of the weekly plan
 * @param {String} menuIdInWeeklyPlan - Menu document id in weekly plan (not weekly menu id)
 */
const getWeeklyPlanDetailsAndOrders = async (
  req,
  year,
  weekNumber,
  menuIdInWeeklyPlan,
) => {
  try {
    const weeklyPlan = await WeeklyPlan.findOne({
      user: req.user._id,
      status: "active",
      year,
      weekNumber,
    }).populate({
      path: "assignMenu.menu",
    });

    // Get weekly plan assigned menu details and customers
    const weeklyPlanDetails = weeklyPlan.assignMenu.find(
      (assigned) => assigned._id.toString() === menuIdInWeeklyPlan,
    );

    // Check if single day order for current week is already published
    const singleDayOrders = await SingleDayOrder.find({
      user: req.user._id,
      year,
      weekNumber,
    });

    // Return weekly plan details and single day orders
    return { weeklyPlanDetails, singleDayOrders };
  } catch (error) {
    console.error("Error getting details from request:", error.message);
  }
};

module.exports = { publishOrders, unpublishOrders };
