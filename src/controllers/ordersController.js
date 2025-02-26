const { roundTo } = require("../helper/roundeNumber");
const SingleDayOrder = require("../models/SingleDayOrder");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const IngredientsStock = require("../models/IngredientsStock");
const PDFDocument = require("pdfkit");
const fs = require("fs");

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
  }).select("_id year weekNumber day status expired");

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
          weeklyMenuTitle: order.expired
            ? meal.weeklyMenuTitle
            : meal.weeklyMenu.title,
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

  // Check if order expired than any changes are not allowed
  if (order.expired) {
    return next(
      new AppError(
        "Order has expired, therefore no actions can be performed.",
        400,
      ),
    );
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
  }).populate({
    path: "categories.meals.weeklyMenu",
  });

  // Check if order exists
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // Check if order expired than any changes are not allowed
  if (order.expired) {
    return next(
      new AppError(
        "Order has expired, therefore no actions can be performed.",
        400,
      ),
    );
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
  }).select("_id year weekNumber day status categories expired");

  // Check if orders exist
  if (!orders.length) {
    return next(new AppError("Orders not found", 404));
  }

  // Refactor orders and calculate general amount of ingredients
  const ingredientsLists = orders.map((order) => {
    // Create a map to store ingredients
    const list = new Map();

    // Iterate over each category
    order.categories.forEach((category) => {
      // Iterate over each meal
      category.meals.forEach((meal) => {
        // Iterate over each ingredient
        meal.meal.ingredients.forEach((ingredient) => {
          // Create ingredient key
          const ingredientKey = ingredient.ingredientId.toString();

          // Get number of customers
          const customers = meal.customers.length;

          // Check if ingredient already exists
          if (list.has(ingredientKey)) {
            list.set(ingredientKey, {
              ...list.get(ingredientKey),
              mealsToUse: [
                ...list.get(ingredientKey).mealsToUse,
                {
                  meal: meal.meal.title,
                  quantity: customers,
                  amountPerPortion: ingredient.currentAmount,
                },
              ],
              generalAmount: roundTo(
                list.get(ingredientKey).generalAmount +
                  customers * ingredient.currentAmount,
                2,
              ),
            });
          } else {
            // Add ingredient to the list
            list.set(ingredientKey, {
              _id: ingredient.ingredientId,
              title: ingredient.title,
              mealsToUse: [
                {
                  meal: meal.meal.title,
                  quantity: customers,
                  amountPerPortion: ingredient.currentAmount,
                },
              ],
              generalAmount: roundTo(customers * ingredient.currentAmount, 2),
              unit: ingredient.unit,
            });
          }
        });
      });
    });

    // Return refactored order
    return {
      _id: order._id,
      year: order.year,
      weekNumber: order.weekNumber,
      day: order.day,
      status: order.status,
      expired: order.expired,
      ingredients: Array.from(list.values()),
      updatedAt: order.updatedAt,
      createdAt: order.createdAt,
    };
  });

  // Find any stock data for the provided week
  const ingredientsStock = await IngredientsStock.find({
    user: req.user._id,
    year,
    weekNumber,
  });

  // Refactor ingredients lists and add stock data
  ingredientsLists.forEach((order) => {
    // Find stock data for the day
    const stockData = ingredientsStock.find((stock) => stock.day === order.day);

    // If stock data exists, add it to the order
    if (stockData) {
      order.ingredients.forEach((ingredient) => {
        // Find stock ingredient
        const stockIngredient = stockData.ingredients.find(
          (stock) => stock.ingredient.toString() === ingredient._id.toString(),
        );

        // If stock ingredient exists, add it to the order
        if (stockIngredient) {
          ingredient.stockAmount = stockIngredient.stockAmount;

          // Calculate if ingredient needs restock
          const stockDeficit = roundTo(
            ingredient.generalAmount - stockIngredient.stockAmount,
            2,
          );

          // Add needsRestock to the ingredient
          ingredient.restockNeeded = stockDeficit > 0 ? stockDeficit : 0;
        }
      });
    }
  });

  // Check if combined list egzists in the database
  const combinedList = await IngredientsStock.find({
    user: req.user._id,
    year,
    weekNumber,
    day: null,
    dayCombined: { $exists: true, $not: { $size: 0 } },
  });

  // Refactor combined list
  let combinedListRefactored = [];

  // If combined list exists, create combined days ingredient list from refactored ingredients lists
  if (combinedList.length > 0) {
    // Refactor combined list
    combinedListRefactored = combinedList.map((list) => {
      // Create a map to store ingredients
      const combinedList = new Map();

      // Iterate over each day
      list.dayCombined.forEach((day) => {
        // Find ingredients list for the day
        const dayList = ingredientsLists.find((order) => order.day === day);

        if (dayList && dayList.ingredients.length > 0) {
          // Iterate over each ingredient
          dayList.ingredients.forEach((ingredient) => {
            // Create ingredient key
            const ingredientKey = ingredient._id.toString();

            // Check if ingredient already exists
            if (combinedList.has(ingredientKey)) {
              combinedList.set(ingredientKey, {
                ...combinedList.get(ingredientKey),
                mealsToUse: [
                  ...combinedList.get(ingredientKey).mealsToUse,
                  ...ingredient.mealsToUse,
                ],
                generalAmount: roundTo(
                  combinedList.get(ingredientKey).generalAmount +
                    ingredient.generalAmount,
                  2,
                ),
              });
            } else {
              // Add ingredient to the list
              combinedList.set(ingredientKey, {
                _id: ingredient._id,
                title: ingredient.title,
                mealsToUse: [...ingredient.mealsToUse],
                generalAmount: ingredient.generalAmount,
                unit: ingredient.unit,
              });
            }
          });
        }
      });

      console.log("list", list);

      // Check if stock data exists on the combined list
      if (list.ingredients.length > 0) {
        // Add stock data to the combined list
        list.ingredients.forEach((obj) => {
          // Check if ingredient already exists in the combined list
          if (combinedList.has(obj.ingredient.toString())) {
            combinedList.get(obj.ingredient.toString()).stockAmount =
              obj.stockAmount;

            // Calculate if ingredient needs restock
            const stockDeficit = roundTo(
              combinedList.get(obj.ingredient.toString()).generalAmount -
                obj.stockAmount,
              2,
            );

            // Add needsRestock to the ingredient
            combinedList.get(obj.ingredient.toString()).restockNeeded =
              stockDeficit > 0 ? stockDeficit : 0;
          }
        });
      }

      // Check if all days from the combined list are done in orders
      const allDaysDone = list.dayCombined.every((day) => {
        const order = orders.find((order) => order.day === day);
        return order.status === "done";
      });

      // Return refactored combined list
      return {
        combineListDocId: list._id,
        year: list.year,
        weekNumber: list.weekNumber,
        dayCombined: list.dayCombined,
        allDaysDone,
        ingredients: Array.from(combinedList.values()),
        updatedAt: list.updatedAt,
        createdAt: list.createdAt,
      };
    });
  }

  // Return response
  res.status(200).json({
    status: "success",
    data: {
      generalList: ingredientsLists,
      combinedList: combinedListRefactored,
    },
  });
});

/**
 * Enter ingredient stock amount for the provided day
 */
exports.enterIngredientStock = catchAsync(async (req, res, next) => {
  const { year, weekNumber, days, ingredientId, stockQuantity } = req.body;

  // Check if all required fields are provided
  if (!year || !weekNumber || !ingredientId || !stockQuantity) {
    return next(new AppError("Please provide all required fields", 400));
  }

  // Check if order not expired
  const order = await SingleDayOrder.findOne({
    user: req.user._id,
    year,
    weekNumber,
  });

  if (order.expired) {
    return next(
      new AppError(
        "Order has expired, therefore no actions can be performed.",
        400,
      ),
    );
  }

  // Check if days are provided as an array with at least one day
  if (!Array.isArray(days) || days.length === 0) {
    return next(
      new AppError(
        "Please provide days as an array with at least one day",
        400,
      ),
    );
  }

  // Declare ingredients stock variable
  let ingredientsStock;

  // Check if days have more than one day
  if (Array.isArray(days) && days.length > 1) {
    // Check if combined list document already exists
    ingredientsStock = await IngredientsStock.findOne({
      user: req.user._id,
      year,
      weekNumber,
      dayCombined: { $all: days },
    });

    // If combined list document doesn't exist, create it
    if (!ingredientsStock) {
      return next(new AppError("Combined list not found", 404));
    }
  } else {
    // Check if ingredients stock document already exists
    ingredientsStock = await IngredientsStock.findOne({
      user: req.user._id,
      year,
      weekNumber,
      day: days[0],
    });

    // If ingredients stock document doesn't exist, create it
    if (!ingredientsStock) {
      ingredientsStock = await IngredientsStock.create({
        user: req.user._id,
        year,
        weekNumber,
        day: days[0],
      });
    }
  }

  // Find ingredient index
  const ingredientIndex = ingredientsStock.ingredients.findIndex(
    (ingredient) => ingredient.ingredient.toString() === ingredientId,
  );

  console.log("ingredientIndex", ingredientIndex);

  // If ingredient exists, update stock amount
  if (ingredientIndex !== -1) {
    ingredientsStock.ingredients[ingredientIndex].stockAmount =
      Number(stockQuantity);
  } else {
    // If ingredient doesn't exist, add it
    ingredientsStock.ingredients.push({
      ingredient: ingredientId,
      stockAmount: Number(stockQuantity),
    });
  }

  // Save changes
  await ingredientsStock.save();

  // Return response
  return res.status(200).json({
    status: "success",
    message: "Ingredient stock amount entered successfully",
  });
});

/**
 * Create combined ingredients list for the provided week
 */
exports.createCombinedIngredientsList = catchAsync(async (req, res, next) => {
  const { year, weekNumber, days } = req.body;

  // Check if all required fields are provided
  if (!year || !weekNumber || !days || days.length < 2) {
    return next(new AppError("Please provide all required fields", 400));
  }

  // Check if order not expired
  const order = await SingleDayOrder.findOne({
    user: req.user._id,
    year,
    weekNumber,
  });

  if (order.expired) {
    return next(
      new AppError(
        "Order has expired, therefore no actions can be performed.",
        400,
      ),
    );
  }

  // Check if combined list already exists
  const combinedList = await IngredientsStock.findOne({
    user: req.user._id,
    year,
    weekNumber,
    dayCombined: { $all: days },
  });

  // If combined list exists, return an error
  if (combinedList) {
    return next(new AppError("Combined list already exists", 400));
  }

  // Check if all single day orders exist
  const orders = await SingleDayOrder.find({
    user: req.user._id,
    year,
    weekNumber,
    day: { $in: days },
  });

  // If not all orders exist, return an error
  if (orders.length !== days.length) {
    return next(new AppError("Not all orders exist", 400));
  }

  // Create combined list document
  await IngredientsStock.create({
    user: req.user._id,
    year,
    weekNumber,
    dayCombined: days,
  });

  // Return response
  res.status(200).json({
    status: "success",
  });
});

/**
 * Delete ingredient stock amount for the provided day
 */
exports.deleteSingleDayIngredientStock = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { year, weekNumber, days, ingredientId } = req.body;

  // Check if all required fields are provided
  if (!year || !weekNumber || !days.length || !ingredientId) {
    return next(new AppError("Please provide all required fields", 400));
  }

  // Check if single day order exists
  const order = await SingleDayOrder.findOne({
    user: req.user._id,
    _id: id,
  });

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // Check if order expired than any changes are not allowed
  if (order.expired) {
    return next(
      new AppError(
        "Order has expired, therefore no actions can be performed.",
        400,
      ),
    );
  }

  // Check if provided day is in the order
  if (!days.includes(order.day)) {
    return next(new AppError("Day not found in the order", 400));
  }

  // Declare ingredients stock variable
  let ingredientsStock;

  // Check if days have more than one day
  if (days.length > 1) {
    // Check if combined list document already exists
    ingredientsStock = await IngredientsStock.findOne({
      user: req.user._id,
      year,
      weekNumber,
      dayCombined: { $all: days },
    });
  } else {
    // Check if ingredients stock document already exists
    ingredientsStock = await IngredientsStock.findOne({
      user: req.user._id,
      year,
      weekNumber,
      day: days[0],
    });
  }

  // If ingredients stock document doesn't exist, return an error
  if (!ingredientsStock) {
    return next(new AppError("Ingredients stock not found", 404));
  }

  // Find ingredient index
  const ingredientIndex = ingredientsStock.ingredients.findIndex(
    (ingredient) => ingredient.ingredient.toString() === ingredientId,
  );

  // If ingredient exists, delete it
  if (ingredientIndex !== -1) {
    ingredientsStock.ingredients.splice(ingredientIndex, 1);
  }

  // If ingredients list is empty, delete the document
  if (ingredientsStock.ingredients.length === 0) {
    await ingredientsStock.deleteOne();
  } else {
    // Save changes
    await ingredientsStock.save();
  }

  // Return response
  return res.status(200).json({
    status: "success",
    message: "Ingredient stock amount deleted successfully",
  });
});

/**
 * Remove combined ingredients list
 */
exports.deleteCombinedIngredientsList = catchAsync(async (req, res, next) => {
  const { year, weekNumber, days } = req.body;

  // Check if all required fields are provided
  if (!year || !weekNumber || !days || days.length < 2) {
    return next(new AppError("Please provide all required fields", 400));
  }

  // Check if order not expired
  const order = await SingleDayOrder.findOne({
    user: req.user._id,
    year,
    weekNumber,
  });

  if (order.expired) {
    return next(
      new AppError(
        "Order has expired, therefore no actions can be performed.",
        400,
      ),
    );
  }

  // Check if combined list already exists
  const combinedList = await IngredientsStock.findOne({
    user: req.user._id,
    year,
    weekNumber,
    dayCombined: { $all: days },
  });

  // If combined list doesn't exist, return an error
  if (!combinedList) {
    return next(new AppError("Combined list not found", 404));
  }

  // Delete combined list
  await combinedList.deleteOne();

  // Return response
  res.status(200).json({
    status: "success",
  });
});

// Example Ingredients List
const ingredients = [
  { name: "Tomatoes", quantity: 5, unit: "kg" },
  { name: "Onions", quantity: 3, unit: "kg" },
  { name: "Potatoes", quantity: 7, unit: "kg" },
];

/**
 * Generate pdf for combined ingredients list
 */
exports.generateIngredientsPdf = catchAsync(async (req, res, next) => {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream("./pdf/file2.pdf"));

  // Set response headers for inline viewing
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="ingredients.pdf"');

  // Pipe PDF to response
  doc.pipe(res);

  // Title
  doc.fontSize(20).text("Ingredients List", { align: "center" });
  doc.moveDown();

  // Example Table Header
  doc.fontSize(12).text("Ingredient", 50, doc.y);
  doc.text("Quantity", 250, doc.y);
  doc.text("Unit", 350, doc.y);
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(500, doc.y).stroke();
  doc.moveDown();

  // Example Table Rows
  const ingredients = [
    { name: "Tomatoes", quantity: 5, unit: "kg" },
    { name: "Onions", quantity: 3, unit: "kg" },
    { name: "Potatoes", quantity: 7, unit: "kg" },
  ];

  ingredients.forEach((ingredient) => {
    doc.text(ingredient.name, 50, doc.y);
    doc.text(ingredient.quantity.toString(), 250, doc.y);
    doc.text(ingredient.unit, 350, doc.y);
    doc.moveDown();
  });

  // End document
  doc.end();
});
