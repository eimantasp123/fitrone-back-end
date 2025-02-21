const { roundTo } = require("../helper/roundeNumber");
const SingleDayOrder = require("../models/SingleDayOrder");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

/**
 *  Get orders by provided year and week number
 */
exports.getOrders = catchAsync(async (req, res, next) => {
  const { year, weekNumber } = req.query;

  // Collect all orders for the provided year and week number
  const orders = await SingleDayOrder.find({
    user: req.user._id,
    year,
    weekNumber,
    categories: { $exists: true, $not: { $size: 0 } },
  }).select("_id year weekNumber day status");

  // Return response
  res.status(200).json({
    status: "success",
    data: orders,
  });
});

/**
 * Get single day order by id
 */
exports.getOrderById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Find order by id
  const order = await SingleDayOrder.findOne({
    user: req.user._id,
    _id: id,
  })
    .populate([
      {
        path: "categories.meals.meal",
        select: "title ingredients description",
      },
      {
        path: "categories.meals.weeklyMenu",
        select: "title",
      },
      {
        path: "categories.meals.customers",
        select: "firstName lastName",
      },
    ])
    .select("-__v -user");

  // Check if order exists
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // Refactor order and calculate unique customers for each meal
  const refactoredOrder = {
    ...order.toObject(),
    categories: order.categories.map((category) => ({
      ...category.toObject(),
      mealsPerCategory: category.meals.length,
      meals: category.meals.map((meal) => {
        // Map to get unique customers
        const customerMap = new Map();

        // Group customers by id
        meal.customers.forEach((customer) => {
          const customerKey = customer._id.toString();

          // Check if customer already exists
          if (customerMap.has(customerKey)) {
            customerMap.set(customerKey, {
              firstName: customer.firstName,
              lastName: customer.lastName,
              quantity: customerMap.get(customerKey).quantity + 1,
            });
          } else {
            customerMap.set(customerKey, {
              firstName: customer.firstName,
              lastName: customer.lastName,
              quantity: 1,
            });
          }
        });

        // Calculate general amount of ingredients
        const ingredientsQuantity = meal.meal.ingredients.map((ingredient) => ({
          title: ingredient.title,
          generalAmount: roundTo(
            meal.customers.length * ingredient.currentAmount,
            1,
          ),
          currentAmount: ingredient.currentAmount,
          unit: ingredient.unit,
        }));

        // Convert the map to an array
        const groupedCustomers = Array.from(customerMap.values());

        // Return refactored meal
        return {
          mealTitle: meal.meal.title,
          mealDescription: meal.meal.description,
          ingredients: ingredientsQuantity,
          portions: meal.customers.length,
          weeklyMenuTitle: meal.weeklyMenu.title,
          status: meal.status,
          customers: groupedCustomers,
          _id: meal._id,
        };
      }),
    })),
  };

  // Generate general insights on each customer
  const generalInsights = new Map();

  // Map on each category
  for (const category of refactoredOrder.categories) {
    // Map on each meal
    for (const meal of category.meals) {
      // Map on each customer
      for (const customer of meal.customers) {
        // Create customer key
        const customerKey = `${customer.firstName} ${customer.lastName}`;

        // Check if customer already exists
        if (!generalInsights.has(customerKey)) {
          generalInsights.set(customerKey, {
            firstName: customer.firstName,
            lastName: customer.lastName,
            categories: [],
          });
        }

        // Find customer in general insights
        const insightsDetails = generalInsights.get(customerKey);

        // Find category in customer
        let categoryObj = insightsDetails.categories.find(
          (c) => c.category === category.category,
        );

        // If category doesn't exist, create it
        if (!categoryObj) {
          categoryObj = {
            category: category.category,
            meals: [],
          };
          insightsDetails.categories.push(categoryObj);
        }

        // Add meal to category
        categoryObj.meals.push({
          mealTitle: meal.mealTitle,
          quantity: customer.quantity,
        });
      }
    }
  }

  // Convert map to array
  const generalInsightsArray = Array.from(generalInsights.values());

  // Return response
  res.status(200).json({
    status: "success",
    data: refactoredOrder,
    generalInsights: generalInsightsArray,
  });
});

/**
 * Change selected meal status
 */
exports.changeMealStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { mealDocId, status } = req.body;

  // Find order by id
  const order = await SingleDayOrder.findOne({
    user: req.user._id,
    _id: id,
  });

  // Check if order exists
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // Find meal by id
  const meal = order.categories
    .map((category) => category.meals)
    .flat()
    .find((meal) => meal._id.toString() === mealDocId);

  // Check if meal exists
  if (!meal) {
    return next(new AppError("Meal not found", 404));
  }

  // Change meal status
  meal.status = status;

  // Save changes
  await order.save();

  // Return response
  res.status(200).json({
    status: "success",
    message: "Meal status changed successfully",
  });
});

/**
 * Change selected day order status
 */
exports.changeOrderStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  // Find order by id
  const order = await SingleDayOrder.findOne({
    user: req.user._id,
    _id: id,
  });

  // Check if order exists
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // Change meal status
  order.categories.forEach((category) => {
    category.meals.forEach((meal) => {
      meal.status = status === "done" ? "done" : "not_done";
    });
  });

  // Change order status
  order.status = status;

  // Save changes
  await order.save();

  // Return response
  res.status(200).json({
    status: "success",
    message: "Order status changed successfully",
  });
});

/**
 * Get ingredients list for each day
 */
exports.getIngredientsLists = catchAsync(async (req, res, next) => {
  const { year, weekNumber } = req.query;

  // Collect all orders for the provided year and week number
  const orders = await SingleDayOrder.find({
    user: req.user._id,
    year,
    weekNumber,
    categories: { $exists: true, $not: { $size: 0 } },
  })
    .populate([
      {
        path: "categories.meals.meal",
        select: "title ingredients description",
      },
    ])
    .select("_id year weekNumber day status categories");

  // Check if orders exist
  if (!orders.length) {
    return next(new AppError("Orders not found", 404));
  }

  // Generate ingredients list for each day of the week
  const ingredientsLists = orders.map((order) => {
    //
    const list = order.categories
      .map((category) => {
        // Map to get unique ingredients
        const ingredientsMap = new Map();

        // Map to get ingredients
        category.meals.forEach((meal) => {
          // Calculate general amount of ingredients
          const customerAmount = meal.customers.length;

          // Group ingredients by id
          meal.meal.ingredients.forEach((ingredient) => {
            const ingredientKey = ingredient.ingredientId.toString();

            // Check if ingredient already exists
            if (ingredientsMap.has(ingredientKey)) {
              ingredientsMap.set(ingredientKey, {
                ...ingredientsMap.get(ingredientKey),
                generalAmount:
                  ingredientsMap.get(ingredientKey).generalAmount +
                  roundTo(customerAmount * ingredient.currentAmount, 1),
              });
            } else {
              ingredientsMap.set(ingredientKey, {
                _id: ingredient.ingredient,
                title: ingredient.title,
                unit: ingredient.unit,
                perServingAmount: ingredient.currentAmount,
                generalAmount: roundTo(
                  customerAmount * ingredient.currentAmount,
                  1,
                ),
              });
            }
          });
        });

        // Return ingredients list  for each category
        return Array.from(ingredientsMap.values());
      })
      .flat();

    // Return ingredients list for each day
    return {
      year: order.year,
      weekNumber: order.weekNumber,
      day: order.day,
      status: order.status,
      isSnapshot: order.isSnapshot,
      ingredientsList: list,
    };
  });

  // Return response
  res.status(200).json({
    status: "success",
    data: ingredientsLists,
  });
});
