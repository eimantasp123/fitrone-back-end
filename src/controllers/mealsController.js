const axios = require("axios");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const translateText = require("../utils/translator");
const openai = require("openai");
const z = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");

// auth for openai
const openAi = new openai(process.env.OPENAI_API_KEY);

// Schema for the nutrition information
const nutritionSchema = z.object({
  title: z.object({
    lt: z.string(),
    en: z.string(),
  }),
  unit: z.string(),
  amount: z.number(),
  calories: z.number(),
  protein: z.number(),
  fat: z.number(),
  carbs: z.number(),
});

// Get ingredient information from FatSecret API
exports.getIngredientInfo = catchAsync(async (req, res, next) => {
  let { query, unit, amount } = req.body;

  // Get the language from the request object
  const lang = req.lng || "en";

  // Check if the query parameter is provided
  if (!query) {
    return next(new AppError("query parameter is required", 400));
  }

  // Request to openai to get the nutrition information
  const completion = await openAi.beta.chat.completions.parse({
    model: "gpt-4o-2024-08-06",
    messages: [
      {
        role: "system",
        content:
          "Please provide the nutrition information for the given ingredient. Response should include the title of the ingredient, unit, amount, calories, protein, fat, and carbs. Title should be the same as the input ingredient just with the first letter capitalized, grammar corrected and in Lithuanian and English languages. If this ingredient do not exist, please provide empty values for all fields.",
      },
      {
        role: "user",
        content: `
            ingredient: ${query}
            unit: ${unit}
            amount: ${amount}
        `,
      },
    ],
    max_tokens: 2000,
    temperature: 0.5,
    response_format: zodResponseFormat(nutritionSchema, "nutrition"),
  });

  const response = completion.choices[0].message.parsed;

  console.log(response);

  // Send the response
  res.status(200).json({
    status: "success",
    data: {
      title: response.title[lang],
      unit: response.unit,
      amount: response.amount,
      calories: response.calories,
      protein: response.protein,
      fat: response.fat,
      carbs: response.carbs,
    },
  });
});
