const { roundTo } = require("../helper/roundeNumber");
const Ingredient = require("../models/Ingredient");
const Meal = require("../models/Meal");
const AppError = require("./appError");
const { sendMessageToClients } = require("./websocket");

const UpdateService = {
  /**
   * Update an ingredient and propagate the changes to dependent entities.
   * @param {string} ingredientId - The ID of the ingredient to update.
   * @param {Object} updates - The update fields for the ingredient.
   * @param {Object} req - The request object, for translations and user context.
   * @param {Function} next - The `next` function for error forwarding.
   */
  async updateIngredient(ingredientId, updates, req, next) {
    const ingredient = await Ingredient.findOneAndUpdate(
      { _id: ingredientId, user: req.user._id },
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
    UpdateService.updateMealsUsingIngredient(ingredient, req);
  },

  /**
   * Update meals that use the given ingredient.
   * @param {Object} updatedIngredient - The updated ingredient document.
   * @param {Object} req - The request object, for translations and user context.
   */
  async updateMealsUsingIngredient(updatedIngredient, req) {
    // Find all meals that use the ingredient
    try {
      const meals = await Meal.find({
        user: req.user._id,
        deletedAt: null,
        "ingredients.ingredientId": updatedIngredient._id,
      });

      // Update each meal that uses the ingredient
      for (const meal of meals) {
        meal.ingredients = meal.ingredients.map((ingredient) => {
          if (
            ingredient.ingredientId.toString() ===
            updatedIngredient._id.toString()
          ) {
            const scalingFactor =
              ingredient.currentAmount / updatedIngredient.amount;

            return {
              ...ingredient._doc,
              title: updatedIngredient.title,
              unit: updatedIngredient.unit,
              calories: roundTo(updatedIngredient.calories * scalingFactor, 1),
              protein: roundTo(updatedIngredient.protein * scalingFactor, 1),
              fat: roundTo(updatedIngredient.fat * scalingFactor, 1),
              carbs: roundTo(updatedIngredient.carbs * scalingFactor, 1),
            };
          }
          return ingredient;
        });

        // Recalculate the nutrition info for the meal
        meal.nutrition = meal.ingredients.reduce(
          (acc, curr) => {
            acc.calories = roundTo(acc.calories + curr.calories, 1);
            acc.protein = roundTo(acc.protein + curr.protein, 1);
            acc.fat = roundTo(acc.fat + curr.fat, 1);
            acc.carbs = roundTo(acc.carbs + curr.carbs, 1);
            return acc;
          },
          { calories: 0, protein: 0, fat: 0, carbs: 0 },
        );

        // Save the updated meal
        await meal.save();
      }

      // Send client message if meals were updated
      if (Array.isArray(meals) && meals.length > 0) {
        sendMessageToClients(req.user._id, "ingredient_updated_in_meals");
      }
    } catch (error) {
      console.error("Error in updateMealsUsingIngredient", error);
    }
  },
};

module.exports = UpdateService;
