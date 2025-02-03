const { roundTo } = require("../helper/roundeNumber");
const openai = require("openai");
const z = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
const AppError = require("./appError");

/**
 * OpenAI API key
 */
const openAi = new openai(process.env.OPENAI_API_KEY);

/**
 * Nutrition information schema
 */
const nutritions = z.object({
  protein: z.number(),
  fat: z.number(),
  carbs: z.number(),
});

/**
 * Get ingredient information from the FatSecret API
 */

const calculateDailyNutritionIntake = async (
  {
    gender,
    age,
    height,
    weight,
    fitnessGoal,
    physicalActivityLevel,
    preference,
  },
  req,
  next,
) => {
  // Check if required parameters are provided
  if (
    !gender ||
    !age ||
    !height ||
    !weight ||
    !fitnessGoal ||
    !physicalActivityLevel
  ) {
    throw new Error("Missing required parameters for nutrition calculation.");
  }

  const prompt = `
   You are a professional nutritionist and fitness expert. Based on the given user profile, determine the recommended daily intake of **protein (grams), fat (grams), and carbohydrates (grams).** DO NOT calculate calories; just return macronutrient values.

  **User Profile:**
  - Gender: ${gender}
  - Age: ${age}
  - Height: ${height} cm
  - Weight: ${weight} kg
  - Fitness Goal: ${fitnessGoal}
  - Physical Activity Level: ${physicalActivityLevel}
  - Dietary Preference: ${preference || "None"}

  **Instructions:**
  - Base protein needs on **scientific formulas** considering muscle maintenance and growth.
  - Adjust **fat intake based on fitness goal** (e.g., high-fat for keto, moderate for weight loss).
  - Adjust **carb intake based on fitness goal** (e.g., low-carb for keto, high-carb for endurance).
      `;

  try {
    // Request to openai to get the nutrition information
    const completion = await openAi.beta.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content: "You are a fitness and nutrition expert.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
      response_format: zodResponseFormat(nutritions, "nutritions"),
    });

    // Refactor the response object to get the nutrition information
    const response = completion.choices[0].message.parsed;

    if (!response) {
      return next(
        new AppError(
          req.t("customers:errors.couldNotCalculateNutritionIntake"),
          400,
        ),
      );
    }

    // Manually calculate total calories
    const calories = roundTo(
      response.protein * 4 + response.fat * 9 + response.carbs * 4,
      0,
    );

    return {
      calories,
      protein: roundTo(response.protein, 0),
      fat: roundTo(response.fat, 0),
      carbs: roundTo(response.carbs, 0),
    };
  } catch (error) {
    return next(
      new AppError(
        req.t("customers:errors.couldNotCalculateNutritionIntake"),
        400,
      ),
    );
  }
};

module.exports = { calculateDailyNutritionIntake };
