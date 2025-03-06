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
  addDays,
  addWeeks,
  startOfISOWeek,
} = require("date-fns");
const { toZonedTime } = require("date-fns-tz");
const path = require("path");
const PdfPrinter = require("pdfmake");
const fs = require("fs");
const { transformToUppercaseFirstLetter } = require("../utils/generalHelpers");

/**
 *  Get orders by provided year and week number
 */
exports.getOrders = catchAsync(async (req, res, next) => {
  const { year, weekNumber } = req.query;

  // Format current date and get required values
  const userLocalTime = toZonedTime(new Date(), req.user.timezone || "UTC"); // Convert to user timezone
  const formattedDate = format(userLocalTime, "yyyy.MM.dd"); // Format as "yyyy.MM.dd"

  // Collect all orders for the provided year and week number
  const orders = await SingleDayOrder.find({
    user: req.user._id,
    year,
    weekNumber,
    categories: { $exists: true, $not: { $size: 0 } },
  })
    .select("_id year weekNumber day status expired")
    .sort("day");

  let activeOrder = null; // Store active order separately
  let inactiveOrders = []; // Store inactive orders

  // Refactor orders and calculate the date for each order
  orders.forEach((order) => {
    const orderDate = getDateFromWeek(order.year, order.weekNumber, order.day);
    const isActive = orderDate === formattedDate;

    // Refactor order
    const transformedOrder = {
      ...order.toObject(),
      date: orderDate,
      active: isActive,
    };

    if (isActive) {
      activeOrder = transformedOrder;
    } else {
      inactiveOrders.push(transformedOrder);
    }
  });

  // If an active order exists, place it first; otherwise, sort normally with Sunday last
  const sortedOrders = activeOrder
    ? [activeOrder, ...inactiveOrders]
    : inactiveOrders.sort((a, b) => (a.day === 0 ? 1 : b.day === 0 ? -1 : 0));

  // Return response
  res.status(200).json({
    status: "success",
    data: sortedOrders,
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
    return next(new AppError(req.t("orders:errors.orderNotFound"), 400));
  }

  // Refactor order and calculate unique customers for each meal
  const refactoredOrder = {
    ...order.toObject(),
    date: getDateFromWeek(order.year, order.weekNumber, order.day),
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
    return next(new AppError(req.t("orders:errors.orderNotFound"), 400));
  }

  // Check if order expired than any changes are not allowed
  if (order.expired) {
    return next(new AppError(req.t("orders:errors.orderExpired"), 400));
  }

  // If order done than any changes are not allowed
  if (order.status === "done") {
    return next(new AppError(req.t("orders:errors.orderDone"), 400));
  }

  // Find meal by id
  const meal = order.categories
    .map((category) => category.meals)
    .flat()
    .find((meal) => meal._id.toString() === mealDocId);

  // Check if meal exists
  if (!meal) {
    return next(new AppError(req.t("orders:errors.mealNotFound"), 400));
  }

  // Change meal status
  meal.status = status;

  // Save changes
  await order.save();

  // Return response
  res.status(200).json({
    status: "success",
    message: req.t("orders:mealStatusChangedSuccessfully"),
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
    return next(new AppError(req.t("orders:errors.orderNotFound"), 400));
  }

  // Check if order expired than any changes are not allowed
  if (order.expired) {
    return next(new AppError(req.t("orders:errors.orderExpired"), 400));
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
    message: req.t("orders:orderStatusChangedSuccessfully"),
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
    .select("_id year weekNumber day status categories expired")
    .sort("day");

  // Check if orders exist
  if (!orders.length) {
    return next(new AppError(req.t("orders:errors.orderNotFound"), 400));
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
      date: getDateFromWeek(order.year, order.weekNumber, order.day),
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

  // Sort ingredients lists by day and push Sunday(0) to the end of the array
  ingredientsLists.sort((a, b) => (a.day === 0 ? 1 : b.day === 0 ? -1 : 0));

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

      // Return refactored combined list
      return {
        combineListDocId: list._id,
        year: list.year,
        weekNumber: list.weekNumber,
        dayCombined: list.dayCombined,
        expired: orders.every((order) => order.expired),
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
      expired: orders.every((order) => order.expired),
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
    return next(
      new AppError(req.t("orders:errors.pleaseProvideAllRequiredFields"), 400),
    );
  }

  // Check if order not expired
  const order = await SingleDayOrder.findOne({
    user: req.user._id,
    year,
    weekNumber,
  });

  if (order.expired) {
    return next(new AppError(req.t("orders:errors.orderExpired"), 400));
  }

  // Check if days are provided as an array with at least one day
  if (!Array.isArray(days) || days.length === 0) {
    return next(
      new AppError(req.t("orders:errors.pleaseProvideDaysAsArray"), 400),
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
      return next(
        new AppError(req.t("orders:errors.combinedListNotFound"), 400),
      );
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
    message: req.t("orders:stockAddedSuccessfully"),
  });
});

/**
 * Create combined ingredients list for the provided week
 */
exports.createCombinedIngredientsList = catchAsync(async (req, res, next) => {
  const { year, weekNumber, days } = req.body;

  // Check if all required fields are provided
  if (!year || !weekNumber || !days || days.length < 2) {
    return next(
      new AppError(req.t("orders:errors.pleaseProvideAllRequiredFields"), 400),
    );
  }

  // Check if order not expired
  const order = await SingleDayOrder.find({
    user: req.user._id,
    year,
    weekNumber,
    day: { $in: days },
  });

  if (order.every((order) => order.expired)) {
    return res.status(200).json({
      status: "warning",
      message: req.t("orders:errors.orderExpired"),
    });
  }

  // Check if combined list already exists
  const combinedList = await IngredientsStock.findOne({
    user: req.user._id,
    year,
    weekNumber,
    dayCombined: { $all: days, $size: days.length },
  });

  // If combined list exists, return an error
  if (combinedList) {
    return res.status(200).json({
      status: "warning",
      message: req.t("orders:errors.combinedListAlreadyExists"),
    });
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
    return next(new AppError(req.t("orders:errors.notAllOrdersExist"), 400));
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
    message: req.t("orders:combinedListCreatedSuccessfully"),
  });
});

/**
 * Delete ingredient stock amount for the provided day
 */
exports.deleteSingleDayIngredientStock = catchAsync(async (req, res, next) => {
  const { year, weekNumber, days, ingredientId } = req.body;

  // Check if all required fields are provided
  if (!year || !weekNumber || !days.length || !ingredientId) {
    return next(
      new AppError(req.t("orders:errors.pleaseProvideAllRequiredFields"), 400),
    );
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
    return next(new AppError(req.t("orders:errors.stockNotFound"), 400));
  }

  // Find ingredient index
  const ingredientIndex = ingredientsStock.ingredients.findIndex(
    (ingredient) => ingredient.ingredient.toString() === ingredientId,
  );

  // If ingredient exists, delete it
  if (ingredientIndex !== -1) {
    ingredientsStock.ingredients.splice(ingredientIndex, 1);
  }

  // Save changes
  await ingredientsStock.save();

  // Return response
  return res.status(200).json({
    status: "success",
    message: req.t("orders:stockDeletedSuccessfully"),
  });
});

/**
 * Remove combined ingredients list
 */
exports.deleteCombinedIngredientsList = catchAsync(async (req, res, next) => {
  const { year, weekNumber, days } = req.body;

  // Check if all required fields are provided
  if (!year || !weekNumber || !days || days.length < 2) {
    return next(
      new AppError(req.t("orders:errors.pleaseProvideAllRequiredFields"), 400),
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
    return next(new AppError(req.t("orders:errors.combinedListNotFound"), 400));
  }

  // Check if order not expired
  const order = await SingleDayOrder.find({
    user: req.user._id,
    year,
    weekNumber,
    day: { $in: days },
  });

  if (order.every((order) => order.expired)) {
    return next(new AppError(req.t("orders:errors.orderExpired"), 400));
  }

  // Delete combined list
  await combinedList.deleteOne();

  // Return response
  res.status(200).json({
    status: "success",
    message: req.t("orders:combinedListDeletedSuccessfully"),
  });
});

/**
 * Generate pdf for combined ingredients list
 */
exports.generateIngredientsPdf = catchAsync(async (req, res, next) => {
  const { year, weekNumber, day } = req.query;
  const { day: pollutedDays } = req.queryPolluted;

  // Check if required fields are provided
  if (!year || !weekNumber || day === undefined) {
    return next(
      new AppError(req.t("orders:errors.pleaseProvideAllRequiredFields"), 400),
    );
  }

  // Convert days to an array of numbers
  const daysArray = Array.isArray(pollutedDays)
    ? pollutedDays.map((day) => Number(day))
    : [Number(day)];

  // Reorder days and move Sunday to the end of the array
  daysArray.sort((a, b) => a - b);
  const sundayIndex = daysArray.indexOf(0);
  if (sundayIndex !== -1) {
    daysArray.push(daysArray.splice(sundayIndex, 1)[0]);
  }

  // Get orders
  const orders = await getOrdersByDays(
    req.user._id,
    year,
    weekNumber,
    daysArray,
  );

  // Get stock data
  const stockData = await getStockByDays(
    req.user._id,
    year,
    weekNumber,
    daysArray,
  );

  // Validate orders
  if (!orders.length) {
    return next(new AppError(req.t("orders:errors.orderNotFound"), 400));
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
      return next(
        new AppError(req.t("orders:errors.combinedListNotFound"), 400),
      );
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

  // Get formated week range and current date based on user's timezone
  const { formatedWeekRange, dateNow } = getDates(
    year,
    weekNumber,
    req.user.timezone,
  );

  // Get translated days object
  const translatedDays = req.t("orders:ingredientsPdf.days", {
    returnObjects: true,
  });

  // Get days in words
  const daysArrays = daysArray.map((day) => translatedDays[day]).join(" — ");

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

  // Create PDF document definition
  const { docDefinition } = createPdf(
    req,
    finalIngredients,
    daysArrays,
    formatedWeekRange,
    dateNow,
    weekNumber,
    year,
  );

  try {
    // Check environment
    const isDev = process.env.NODE_ENV === "development";
    // Set file path dynamically
    const pdfFileName = `${req.t("orders:ingredientsPdf.ingredientsList")}-${isDev ? Date.now() : dateNow}.pdf`;
    const pdfFilePath = path.join(__dirname, "../../pdf", pdfFileName); // Store in pdf folder
    const pdfDoc = printer.createPdfKitDocument(docDefinition); // Create PDF document

    if (isDev) {
      // Development Mode: Save the PDF to the server
      const writeStream = fs.createWriteStream(pdfFilePath);
      pdfDoc.pipe(writeStream);

      // Production Mode: Directly send the file for download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ingredients.pdf"`,
      );

      // Send response when PDF is saved for postman testing
      // writeStream.on("finish", () => {
      //   res.json({
      //     status: "success",
      //     message: "PDF generated successfully",
      //     pdfUrl: `http://localhost:5000/pdf/${pdfFileName}`,
      //   });
      // });

      // Pipe the PDF to the response
      pdfDoc.pipe(res);
      pdfDoc.end();
    } else {
      // Production Mode: Directly send the file for download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ingredients.pdf"`,
      );

      // Pipe the PDF to the response
      pdfDoc.pipe(res);
      pdfDoc.end();
    }
  } catch (error) {
    console.error("Error generating pdf:", error);
  }
});

/**
 * Get the exact date from a given year, ISO week number, and day of the week.
 * @param {number} year - The year (e.g., 2025)
 * @param {number} weekNumber - The ISO week number (1-53)
 * @param {number} dayOfWeek - The day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * @returns {string} - The formatted date as "yyyy.MM.dd"
 */
const getDateFromWeek = (year, weekNumber, dayOfWeek) => {
  // Get the first day of the given week (ISO weeks start on Monday)
  const weekStartDate = startOfISOWeek(new Date(year, 0, 4)); // Find first Monday of the year
  const correctWeekStart = addDays(weekStartDate, (weekNumber - 1) * 7); // Get start of given week

  // Map day correctly (ISO: Monday = 1, Sunday = 0, but Sunday should be last)
  const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Shift Sunday to end

  // Get the actual date
  const actualDate = addDays(correctWeekStart, adjustedDay);

  // Format the result as "yyyy.MM.dd"
  return format(actualDate, "yyyy.MM.dd");
};

/**
 * Helper function to create pdf for combined ingredients list
 * @param {Object} req - Request object for translation
 * @param {Object} finalIngredients - Final ingredients list
 * @param {String} daysArrays - Days in words
 * @param {String} formatedWeekRange - Formated week range
 * @param {String} dateNow - Current date in user's timezone
 * @param {Number} weekNumber - Week number
 * @param {Number} year - Year number
 * @returns {Object} - PDF document definition
 */
const createPdf = (
  req,
  finalIngredients,
  daysArrays,
  formatedWeekRange,
  dateNow,
  weekNumber,
  year,
) => {
  // Define table structure
  const tableBody = [
    [
      { text: req.t("orders:ingredientsPdf.ingredient"), style: "tableHeader" },
      { text: req.t("orders:ingredientsPdf.unit"), style: "tableHeader" },
      {
        text: req.t("orders:ingredientsPdf.stockAmount"),
        style: "tableHeader",
      },
      {
        text: req.t("orders:ingredientsPdf.generalAmount"),
        style: "tableHeader",
      },
      { text: req.t("orders:ingredientsPdf.needAmount"), style: "tableHeader" },
    ],
  ];

  // Add rows dynamically
  finalIngredients.ingredients.forEach((item) => {
    tableBody.push([
      {
        text: transformToUppercaseFirstLetter(item.title),
        style: "tableRowFirst",
      },
      { text: `${item.unit}.`, style: "tableRowOthers" },
      {
        text: item.stockAmount ? item.stockAmount : " - ",
        style: "tableRowOthers",
      },
      { text: item.generalAmount, style: "tableRowOthers" },
      {
        text: item.stockAmount
          ? `${item.restockNeeded}${item.unit}.`
          : `${item.generalAmount}${item.unit}.`,
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
        text: req.t("orders:ingredientsPdf.page", {
          page: currentPage,
          pages: pageCount,
        }),
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
                text: `${req.t("orders:ingredientsPdf.ingredientsListTitle")}\n`,
                fontSize: 12,
                color: "#ffffff",
                bold: true,
              },

              {
                text: req.t("orders:ingredientsPdf.listGenerated", {
                  date: dateNow,
                }),
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
        text: req.t("orders:ingredientsPdf.firstShortDescription"),
        alignment: "center",
        fontSize: 10,
        color: "#1f1f1f",
        bold: true,
        margin: [40, 20, 40, 1],
      },
      {
        text: req.t("orders:ingredientsPdf.secondShortDescription"),
        alignment: "center",
        fontSize: 10,
        color: "#373737",
        margin: [40, 0, 40, 5],
      },

      {
        text: [
          {
            text: `${req.t("orders:ingredientsPdf.listAttached")}: `,
          },
          {
            text: `${year} ${req.t("orders:ingredientsPdf.week", { week: weekNumber })} | (${formatedWeekRange})`,
            bold: true,
          },
        ],
        margin: [40, 20, 40, 0],
        fontSize: 10,
      },

      {
        text: [
          {
            text: `${req.t("orders:ingredientsPdf.selectedDays")}: `,
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
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
        dontBreakRows: true,
        keepWithHeaderRows: 1,
        margin: [40, 0, 40, 0],
      },

      {
        text: `${req.t("orders:ingredientsPdf.generalFieldsExplanation")}:`,
        margin: [40, 10, 40, 0],
        fontSize: 10,
      },

      {
        text: [
          {
            text: `${req.t("orders:ingredientsPdf.unit")} - `,
            bold: true,
          },
          {
            text: req.t("orders:ingredientsPdf.unitExplanation"),
          },
        ],
        margin: [40, 2, 30, 0],
        fontSize: 10,
      },

      {
        text: [
          {
            text: `${req.t("orders:ingredientsPdf.stockAmount")} - `,
            bold: true,
          },
          {
            text: req.t("orders:ingredientsPdf.stockAmountExplanation"),
          },
        ],
        margin: [40, 2, 30, 0],
        fontSize: 10,
      },

      {
        text: [
          {
            text: `${req.t("orders:ingredientsPdf.generalAmount")} - `,
            bold: true,
          },
          {
            text: req.t("orders:ingredientsPdf.generalAmountExplanation"),
          },
        ],
        margin: [40, 2, 30, 0],
        fontSize: 10,
      },

      {
        text: [
          {
            text: `${req.t("orders:ingredientsPdf.needAmount")} - `,
            bold: true,
          },
          {
            text: req.t("orders:ingredientsPdf.needAmountExplanation"),
          },
        ],
        margin: [40, 2, 30, 0],
        fontSize: 10,
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

  return { docDefinition };
};

/**
 * Helper function to get dates
 * @param {Number} year - Year
 * @param {Number} weekNumber - Week number
 * @param {String} timezone - User's timezone
 * @returns {Object} - Formated week range and current date
 */
const getDates = (year, weekNumber, timezone) => {
  // Set date to the first day of the given week in UTC
  let startDate = setWeek(
    setYear(new Date(Date.UTC(year, 0, 1)), year),
    weekNumber,
    { weekStartsOn: 1 },
  );

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
