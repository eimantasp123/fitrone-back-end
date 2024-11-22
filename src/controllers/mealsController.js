const axios = require("axios");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const translateText = require("../utils/translator");

// Get ingredient information from FatSecret API
exports.getIngredientInfo = catchAsync(async (req, res, next) => {
  let { query } = req.body;

  // Edamam API credentials
  const APP_ID = process.env.EDAMAM_API_ID;
  const APP_KEY = process.env.EDAMAM_API_KEY;

  // Get the language from the request object
  const lang = req.lng || "en";

  // Check if the query parameter is provided
  if (!query) {
    return next(new AppError("query parameter is required", 400));
  }

  // Translate the query to English if the language is not English

  if (lang === "lt") {
    const translated_query = await translateText(query, "en");
    if (query === translated_query) {
      return res.status(200).json({
        status: "fail",
        food: null,
      });
    } else {
      query = translated_query;
    }
  }

  // Fetch ingredient information from FatSecret API in English language
  try {
    // Make request to Edamam API
    const response = await axios.get(
      "https://api.nal.usda.gov/fdc/v1/foods/search",
      {
        params: {
          query: `${query}`,
          api_key: process.env.USDA_API_KEY,
          pageSize: 10,
          pageNumber: 1,
        },
      },
    );

    res.status(200).json({
      status: "success",
      food: response.data || null,
    });
  } catch (error) {
    next(new AppError("Error fetching ingredients", 500));
  }
});

// Get ingredient information by id from FatSecret API
exports.getIngredientInfoById = catchAsync(async (req, res, next) => {
  const { id: foodId } = req.params;
  const { unit, amount: quantity } = req.body;

  // Edamam API credentials
  const APP_ID = process.env.EDAMAM_API_ID;
  const APP_KEY = process.env.EDAMAM_API_KEY;

  // Check if the foodId parameter is provided
  if (!foodId) {
    return next(new AppError("foodId parameter is required", 400));
  }

  // Map the unit to its corresponding URI
  const measureURI = unitMappings[unit];

  // Fetch ingredient information from FatSecret API
  try {
    const response = await axios.post(
      "https://api.edamam.com/api/food-database/v2/nutrients",
      {
        ingredients: [
          {
            quantity,
            measureURI,
            foodId,
          },
        ],
      },
      {
        params: {
          app_id: APP_ID,
          app_key: APP_KEY,
        },
      },
    );

    // Extract the required data from the response
    const foodData = {
      totalWeight: response.data.totalWeight,
      totalNutrients: {
        calories: response.data.totalNutrients.ENERC_KCAL,
        protein: response.data.totalNutrients.PROCNT,
        fat: response.data.totalNutrients.FAT,
        carbs: response.data.totalNutrients.CHOCDF,
      },
    };

    // Send the response
    res.status(200).json({
      status: "success",
      data: foodData,
    });
  } catch (error) {
    next(new AppError("Error fetching ingredient by id", 500));
  }
});

// Map the unit to its corresponding URI
const unitMappings = {
  g: "http://www.edamam.com/ontologies/edamam.owl#Measure_gram",
  ml: "http://www.edamam.com/ontologies/edamam.owl#Measure_milliliter",
  cup: "http://www.edamam.com/ontologies/edamam.owl#Measure_cup",
  tbsp: "http://www.edamam.com/ontologies/edamam.owl#Measure_tablespoon",
  tsp: "http://www.edamam.com/ontologies/edamam.owl#Measure_teaspoon",
};
