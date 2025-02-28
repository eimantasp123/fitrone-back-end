const { roundTo } = require("../helper/roundeNumber");
const SingleDayOrder = require("../models/SingleDayOrder");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const IngredientsStock = require("../models/IngredientsStock");
const {
  startOfWeek,
  endOfWeek,
  format,
  setWeek,
  setYear,
} = require("date-fns");
const { toZonedTime } = require("date-fns-tz");
const path = require("path");
const PdfPrinter = require("pdfmake");
const { table } = require("console");
const { doesNotThrow } = require("assert");
const { transformToUppercaseFirstLetter } = require("../utils/generalHelpers");

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

    // Generate ingredient list
    generateIngredientList(order, list);

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
  ingredientsLists.forEach((orderDay) => {
    // Combine ingredients list with stock data
    combineIngredientsList(orderDay, ingredientsStock);
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
      const lists = new Map();

      // Combine multiple days ingredients list
      combineMultipleDaysIngredientsList(list, ingredientsLists, lists);

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
        ingredients: Array.from(lists.values()),
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
  const order = await SingleDayOrder.find({
    user: req.user._id,
    year,
    weekNumber,
    day: { $in: days },
  });

  if (order.every((order) => order.expired)) {
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

  // Check if order not expired
  const order = await SingleDayOrder.find({
    user: req.user._id,
    year,
    weekNumber,
    day: { $in: days },
  });

  if (order.every((order) => order.expired)) {
    return next(
      new AppError(
        "Order has expired, therefore no actions can be performed.",
        400,
      ),
    );
  }

  // Delete combined list
  await combinedList.deleteOne();

  // Return response
  res.status(200).json({
    status: "success",
  });
});

/**
 * Generate pdf for combined ingredients list
 */
exports.generateIngredientsPdf = catchAsync(async (req, res, next) => {
  // const { year, weekNumber, day } = req.query;
  // const { day: pollutedDays } = req.queryPolluted;

  const userId = "6783fab25298f3bc283577e7";
  const year = 2025;
  const weekNumber = 9;
  const day = 0;
  const pollutedDays = [2, 1, 5, 4, 3, 6];
  // const pollutedDays = {};

  // Check if required fields are provided
  if (!year || !weekNumber || day === undefined) {
    return next(new AppError("Please provide all required fields", 400));
  }

  // Convert days to an array of numbers
  const daysArray = Array.isArray(pollutedDays)
    ? pollutedDays.map((day) => Number(day))
    : [Number(day)];

  // Reorder days and push sunday to the end of the array
  daysArray.sort((a, b) => a - b);
  const sundayIndex = daysArray.indexOf(0);
  if (sundayIndex !== -1) {
    daysArray.push(daysArray.splice(sundayIndex, 1)[0]);
  }

  // Get orders
  const orders = await getOrdersByDays(
    // req.user._id,
    userId,
    year,
    weekNumber,
    daysArray,
  );

  // Get stock data
  const stockData = await getStockByDays(
    // req.user._id,
    userId,
    year,
    weekNumber,
    daysArray,
  );

  // Validate orders
  if (!orders.length) {
    return next(new AppError("Orders not found", 404));
  }

  // Generate ingredient lists
  const ingredientsList = orders.map((orderDay) => {
    // Create a map to store ingredients
    const list = new Map();

    // Generate ingredient list
    generateIngredientList(orderDay, list);

    // Return refactored order
    return {
      day: orderDay.day,
      ingredients: Array.from(list.values()),
    };
  });

  // Handle single day and multiple days logic
  let finalIngredients = {
    year,
    weekNumber,
    days: [],
    ingredients: [],
  };

  // If there are polluted days, generate a pdf with the days
  if (daysArray.length > 1) {
    // Multi-day ingredients combination
    const combinedList = stockData.find((stock) => stock.day === null);

    // Check if combined list exists
    if (!combinedList) {
      return next(new AppError("Combined list not found", 404));
    }

    // Create a map to store combined ingredients
    const comboList = new Map();

    // Combine multiple days ingredients list
    combineMultipleDaysIngredientsList(
      combinedList,
      ingredientsList,
      comboList,
    );

    // Create pure ingredients list with combined days
    finalIngredients = {
      ...finalIngredients,
      days: daysArray,
      ingredients: Array.from(comboList.values()),
    };
  } else {
    // Combine Single-day ingredients with stock
    ingredientsList.forEach((orderDay) => {
      combineIngredientsList(orderDay, stockData);
    });

    // Create pure ingredients list with single day
    finalIngredients = {
      ...finalIngredients,
      days: daysArray,
      ingredients: ingredientsList[0].ingredients,
    };
  }

  // Get dates
  const { formatedWeekRange, dateNow } = getDates(
    year,
    weekNumber,
    req.user.timezone,
  );

  const days = {
    0: "Sekmadienis",
    1: "Pirmadienis",
    2: "Antradienis",
    3: "Treciadienis",
    4: "Ketvirtadienis",
    5: "Penktadienis",
    6: "Sestadienis",
  };

  // Get days in words
  const daysArrays = daysArray.map((day) => days[day]).join(" — ");

  console.log("finalIngredients", finalIngredients);

  // Define fonts
  const fonts = {
    Roboto: {
      normal: path.join(__dirname, "../fonts/Roboto-Regular.ttf"),
      bold: path.join(__dirname, "../fonts/Roboto-Bold.ttf"),
      italics: path.join(__dirname, "../fonts/Roboto-Italic.ttf"),
      bolditalics: path.join(__dirname, "../fonts/Roboto-BoldItalic.ttf"),
    },
  };

  // Create a pdfmake printer instance
  const printer = new PdfPrinter(fonts);

  // Define table structure
  const tableBody = [
    [
      { text: "Ingredient", style: "tableHeader" },
      { text: "General amount", style: "tableHeader" },
      { text: "Stock amount", style: "tableHeader" },
      { text: "Unit", style: "tableHeader" },
      { text: "Needed amount", style: "tableHeader" },
    ],
  ];

  // Add rows dynamically
  finalIngredients.ingredients.forEach((item) => {
    tableBody.push([
      {
        text: transformToUppercaseFirstLetter(item.title),
        style: "tableRowFirst",
      },
      { text: item.generalAmount, style: "tableRowOthers" },
      {
        text: item.stockAmount ? item.stockAmount : " - ",
        style: "tableRowOthers",
      },
      { text: item.unit, style: "tableRowOthers" },
      {
        text: item.stockAmount ? item.restockNeeded : item.generalAmount,
        style: "neededAmount",
      }, // Orange background
    ]);
  });

  // PDF Document Definition
  const docDefinition = {
    pageSize: "A4",
    pageMargins: [0, 20, 0, 40], // Left, Top, Right, Bottom

    footer: function (currentPage, pageCount) {
      return {
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: "center",
        fontSize: 10,
        margin: [0, 10, 0, 0], // Move it slightly down
      };
    },

    background: function () {
      return {
        canvas: [
          {
            type: "rect",
            x: 0,
            y: 0,
            w: 595.28,
            h: 841.89,
            color: "#f5f5f5",
          },
        ],
      }; // Light gray background
    },
    content: [
      // HEADER
      {
        canvas: [
          {
            type: "rect",
            x: 0,
            y: -20,
            w: 595.28,
            h: 80,
            color: "#00180D",
          },
        ], // Black header
      },
      {
        columns: [
          {
            text: [
              {
                text: "Ingredients list\n",
                fontSize: 12,
                color: "#ffffff",
                bold: true,
              },
              {
                text: `List generated on ${dateNow}`,
                fontSize: 10,
                bold: false,
                color: "#d9d9d9",
              },
            ],
            margin: [40, -55, 0, 20],
          },
          {
            image: path.join(__dirname, "../assets/logo-white.png"),
            fit: [70, 70],
            alignment: "right",
            margin: [0, -60, 20, 20], // Move logo up
          },
        ],
      },

      // CENTERED TEXT BELOW HEADER
      {
        text: `This document contains the ingredient list required for the selected period.`,
        alignment: "center",
        fontSize: 10,
        color: "#1f1f1f",
        bold: true,
        margin: [40, 20, 40, 1],
      },
      {
        text: `It includes general stock levels, needed quantities, and units of measurement.`,
        alignment: "center",
        fontSize: 10,
        color: "#373737",
        margin: [40, 0, 40, 5],
      },

      {
        text: [
          {
            text: `Ingredients list is attached for:`,
          },
          {
            text: ` Week ${weekNumber} `,
            bold: true,
          },
        ],
        margin: [40, 20, 40, 0],
        fontSize: 10,
      },

      {
        text: [
          {
            text: `Date Range: `,
          },
          {
            text: `${formatedWeekRange}`,
            bold: true,
          },
        ],
        margin: [40, 2, 30, 0],
        fontSize: 10,
      },

      {
        text: [
          {
            text: `Selected Day(s): `,
          },
          {
            text: `${daysArrays}`,
            bold: true,
          },
        ],
        margin: [40, 2, 30, 8],
        fontSize: 10,
      },

      // TABLE
      {
        table: {
          headerRows: 1,
          widths: [140, "*", "*", "*", "*"], // Adjust columns
          body: tableBody,
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => "#cecece",
          vLineColor: () => "#cecece",
          paddingTop: () => 5, // Space inside cells
          paddingBottom: () => 5, // Space inside cells
        },
        dontBreakRows: true,
        keepWithHeaderRows: 1,
        // pageBreak: "before", // Ensure smooth breaks
        margin: [40, 0, 40, 0],
      },
    ],
    styles: {
      sectionTitle: {
        fontSize: 10,
        bold: true,
        margin: [40, 10, 0, 5],
      },
      tableHeader: {
        color: "#ffffff",
        fillColor: "#00180D",
        alignment: "center",
        fontSize: 9,
        margin: [5, 5, 5, 5],
      },
      tableRowFirst: {
        fontSize: 10,
        margin: [3, 0, 3, 0],
      },
      tableRowOthers: {
        fontSize: 10,
        alignment: "center",
      },
      neededAmount: {
        fillColor: "#e7e7e7",
        color: "#00180D",
        fontSize: 10,
        alignment: "center",
      },
    },
  };

  try {
    // Create a PDF document
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    // Set response headers to open/download PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="generated.pdf"');

    // Pipe PDF document to response stream
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.log(error);
  }
});

/**
 * Helper function to get dates
 * @param {Number} year - Year
 * @param {Number} weekNumber - Week number
 * @param {String} timezone - User's timezone
 * @returns {Object} - Formated week range and current date
 */
const getDates = (year, weekNumber, timezone) => {
  // Set the date to the first day of the given week in the year
  let startDate = setWeek(setYear(new Date(), year), weekNumber);

  // Get the start and end of the week
  const startOfWeekDate = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday start
  const endOfWeekDate = endOfWeek(startDate, { weekStartsOn: 1 }); // Sunday end

  // Formated date to display week range
  const formatedWeekRange = `${format(startOfWeekDate, "yyyy.MM.dd")} — ${format(endOfWeekDate, "yyyy.MM.dd")}`;

  // Get current date in UTC
  const now = new Date();

  // Convert to user's timezone
  const zonedDate = toZonedTime(now, timezone || "UTC");

  // Format date as YYYY.MM.DD HH:mm
  const formattedDate = format(zonedDate, "yyyy.MM.dd HH:mm");

  // Add 'h' to the end of the date
  const dateNow = `${formattedDate}h`;

  return { formatedWeekRange, dateNow };
};

// Helper function to fetch orders based on days
const getOrdersByDays = async (userId, year, weekNumber, daysArray) => {
  return await SingleDayOrder.find({
    user: userId,
    year,
    weekNumber,
    day: { $in: daysArray },
  });
};

// Helper function to fetch stock based on days
const getStockByDays = async (userId, year, weekNumber, daysArray) => {
  return await IngredientsStock.find({
    user: userId,
    year,
    weekNumber,
    $or: [
      { day: { $in: daysArray } },
      { day: null, dayCombined: { $all: daysArray } }, // For combined lists
    ],
  });
};

/**
 * Helper function to generate ingredient list for the provided day
 * @param {Object} order - Single day order document
 * @param {Map} list - Map to store ingredients
 */
const generateIngredientList = (order, list) => {
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
};

/**
 * Helper function to combine ingredients list with stock data
 * @param {Object} orderDay - Single day order document
 * @param {Array} ingredientsStock - Ingredients stock document
 */
const combineIngredientsList = (orderDay, ingredientsStock) => {
  // Find stock data for the day
  const stockData = ingredientsStock.find(
    (stock) => stock.day === orderDay.day,
  );

  // If stock data exists, add it to the order
  if (stockData) {
    orderDay.ingredients.forEach((ingredient) => {
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
};

/**
 * Helper function to combine multiple days ingredients list
 * @param {Object} list - Combined list document
 * @param {Array} ingredientsLists - Ingredients lists for each day
 * @param {Map} combinedList - Map to store combined ingredients
 */
const combineMultipleDaysIngredientsList = (
  list,
  ingredientsLists,
  combinedList,
) => {
  console.log("list", list);
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
};
