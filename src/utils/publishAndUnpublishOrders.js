const IngredientsStock = require("../models/IngredientsStock");
const SingleDayOrder = require("../models/SingleDayOrder");
const catchAsync = require("./catchAsync");
const { sendMessageToClients } = require("./websocket");

/**
 * Publish weekly plan and create single day orders for each day of the week
 * @param {Request} req - Express request object
 * @param {Array} singleDayOrders - Single day orders for current week
 * @param {Object} assignedWeeklyMenu - Assigned weekly menu details
 * @param {Number} year - Year of the weekly plan
 * @param {Number} weekNumber - Week number of the weekly plan
 */
const publishOrders = async (
  req,
  singleDayOrders,
  assignedWeeklyMenu,
  year,
  weekNumber,
) => {
  try {
    // If single day orders on current week are already published, update them with new weekly plan details
    if (singleDayOrders.length > 0) {
      // Map on each single day order
      for (const singleDayOrder of singleDayOrders) {
        // Create category map which will be used to organize meals by category
        const categoryMap = new Map();

        // Map for each meal in the day
        for (const meal of assignedWeeklyMenu.menu.days[singleDayOrder.day]
          .meals) {
          console.log(meal);

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
            weeklyMenu: assignedWeeklyMenu.menu._id,
            status: "not_done",
            customers: assignedWeeklyMenu.assignedClients,
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
      sendMessageToClients(req.user._id, "customer_publish_unpublish_orders");
    } else {
      // Create new single day orders
      const newOrders = assignedWeeklyMenu.menu.days.map((day) => {
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
            weeklyMenu: assignedWeeklyMenu.menu._id,
            status: "not_done",
            customers: assignedWeeklyMenu.assignedClients,
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
      sendMessageToClients(req.user._id, "customer_publish_unpublish_orders");
    }
  } catch (error) {
    console.error("Error publishing orders:", error.message);
  }
};

/**
 * Unpublish weekly plan and remove meals from single day orders
 * @param {Request} req - Express request object
 * @param {Array} singleDayOrders - Single day orders for current week
 * @param {Object} assignedWeeklyMenu - Assigned weekly menu details
 * @param {Number} year - Year of the weekly plan
 * @param {Number} weekNumber - Week number of the weekly plan
 */
const unpublishOrders = async (
  req,
  singleDayOrders,
  assignedWeeklyMenu,
  year,
  weekNumber,
) => {
  try {
    // Map on each single day order
    for (const singleDayOrder of singleDayOrders) {
      // Map on each category of single day order
      for (const category of singleDayOrder.categories) {
        // Filter out meals that belong to the unpublished weekly menu
        category.meals = category.meals.filter(
          (meal) =>
            meal.weeklyMenu.toString() !==
            assignedWeeklyMenu.menu._id.toString(),
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

    // After removing meals from orders, clean up ingredient stock
    await cleanupIngredientsStock(req.user._id, year, weekNumber);

    // Send message to clients
    sendMessageToClients(req.user._id, "customer_publish_unpublish_orders");
  } catch (error) {
    console.error("Error unpublishing orders:", error.message);
  }
};

/**
 * Clean up ingredient stock by removing unused ingredients
 * @param {String} userId - User id
 * @param {Number} year - Year of the weekly plan
 * @param {Number} weekNumber - Week number of the weekly plan
 */
const cleanupIngredientsStock = catchAsync(async (userId, year, weekNumber) => {
  // Find all active orders for this week
  const activeOrders = await SingleDayOrder.find({
    user: userId,
    year,
    weekNumber,
    categories: { $exists: true, $not: { $size: 0 } },
  });

  // If no active orders, clean up all stock documents
  if (activeOrders.length === 0) {
    await IngredientsStock.deleteMany({ user: userId, year, weekNumber });
    return;
  }

  // Get all ingredients still used in active orders
  const activeIngredients = new Set();

  // Loop through each active order and add ingredients to set
  activeOrders.forEach((order) => {
    order.categories.forEach((category) => {
      category.meals.forEach((meal) => {
        meal.meal.ingredients.forEach((ingredient) => {
          activeIngredients.add(ingredient.ingredientId.toString());
        });
      });
    });
  });

  // Find stock documents for this week
  const stockDocuments = await IngredientsStock.find({
    user: userId,
    year,
    weekNumber,
  });

  // Loop through each stock document and remove unused ingredients
  for (const stockDoc of stockDocuments) {
    // Remove ingredients that are not in active orders
    stockDoc.ingredients = stockDoc.ingredients.filter((stockIngredient) =>
      activeIngredients.has(stockIngredient.ingredient.toString()),
    );

    // If stock document is now empty, delete it
    if (stockDoc.ingredients.length === 0) {
      await IngredientsStock.deleteOne({ _id: stockDoc._id });
    } else {
      await stockDoc.save(); // Save changes if there are still ingredients
    }
  }

  console.log("✅ Stock cleanup completed successfully.");
});

module.exports = { publishOrders, unpublishOrders };
