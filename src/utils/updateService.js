const Ingredient = require("../models/Ingredient");
const Meal = require("../models/Meal");
const WeekPlan = require("../models/WeekPlan");
const AppError = require("./appError");

const UpdateService = {
  /**
   * Update an ingredient and propagate the changes to dependent entities.
   * @param {string} ingredientId - The ID of the ingredient to update.
   * @param {Object} updates - The update fields for the ingredient.
   * @param {Object} req - The request object, for translations and user context.
   * @param {Function} next - The `next` function for error forwarding.
   */
  async updateIngredient(ingredientId, updates, req, next) {
    const ingredient = await Ingredient.findByIdAndUpdate(
      ingredientId,
      updates,
      {
        new: true,
      },
    );

    // Check if the ingredient exists
    if (!ingredient) {
      return next(new AppError(req.t("meals:error.ingredientNotFound"), 404));
    }

    // Update meals that use the ingredient
    try {
      await UpdateService.updateMealsUsingIngredient(ingredient, req, next);
    } catch (error) {
      return next(error);
    }
    return ingredient;
  },

  /**
   * Update meals that use the given ingredient.
   * @param {Object} updatedIngredient - The updated ingredient document.
   * @param {Object} req - The request object, for translations and user context.
   * @param {Function} next - The `next` function for error forwarding.
   */
  async updateMealsUsingIngredient(updatedIngredient, req, next) {
    const lang = req.lng || "en";

    // Find all meals that use the ingredient
    const meals = await Meal.find({
      user: req.user._id,
      "ingredients.ingredientId": updatedIngredient._id,
    });

    const updatedMeals = [];

    // Update each meal that uses the ingredient
    for (const meal of meals) {
      try {
        meal.ingredients = meal.ingredients.map((ingredient) => {
          if (
            ingredient.ingredientId.toString() ===
            updatedIngredient._id.toString()
          ) {
            const scalingFactor =
              ingredient.currentAmount / updatedIngredient.amount;

            return {
              ...ingredient._doc,
              title: updatedIngredient.title[lang],
              unit: updatedIngredient.unit,
              calories: (updatedIngredient.calories * scalingFactor).toFixed(1),
              protein: (updatedIngredient.protein * scalingFactor).toFixed(1),
              fat: (updatedIngredient.fat * scalingFactor).toFixed(1),
              carbs: (updatedIngredient.carbs * scalingFactor).toFixed(1),
            };
          }
          return ingredient;
        });

        // Recalculate the nutrition info for the meal
        meal.nutrition = meal.ingredients.reduce(
          (acc, curr) => {
            acc.calories += curr.calories;
            acc.protein += curr.protein;
            acc.fat += curr.fat;
            acc.carbs += curr.carbs;
            return acc;
          },
          { calories: 0, protein: 0, fat: 0, carbs: 0 },
        );

        // Save the updated meal
        await meal.save();
        updatedMeals.push(meal);
      } catch (error) {
        return next(new AppError(req.t("meals:error.mealUpdateError"), 500));
      }

      return updatedMeals;
    }
  },
};

module.exports = UpdateService;
