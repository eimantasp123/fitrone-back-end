const SingleDayOrder = require("../models/SingleDayOrder");
const WeeklyMenu = require("../models/WeeklyMenu");
const WeeklyPlan = require("../models/WeeklyPlan");
const { sendMessageToClients } = require("./websocket");

/**
 * Publish orders management
 */
const publishOrders = async (req, year, weekNumber, menuIdInWeeklyPlan) => {
  // Find current weekly plan with active status and populate assignMenu
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

  // If single day orders are already published, update them with new weekly plan details
  if (singleDayOrders.length > 0) {
    // Update single day orders with new weekly plan details
    console.log("updatefor single day orders");
  } else {
    // Create single day orders for each day of the weekly plan menu
    for (const day of weeklyPlanDetails.menu.days) {
      // Create single day order
      const singleDayOrder = new SingleDayOrder({
        user: req.user._id,
        year,
        weekNumber,
        day: day.day,
      });

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

      // Add categories to single day order
      singleDayOrder.categories = Array.from(categoryMap.values());

      // Save single day order
      await singleDayOrder.save();
    }

    // Send message to clients
    // sendMessageToClients(req.user._id, "singleDayOrders");
  }

  console.log("publishSuccess");
};

/**
 * Unpublish orders management
 */
const unpublishOrders = async (req, year, weekNumber, menuIdInWeeklyPlan) => {
  // Find current weekly plan with active status and populate
  console.log("unpublishSuccess");
};

module.exports = { publishOrders, unpublishOrders };
