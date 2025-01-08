const { roundTo } = require("../helper/roundeNumber");
const Ingredient = require("../models/Ingredient");
const Meal = require("../models/Meal");
const AppError = require("./appError");
const { sendMessageToClients } = require("./websocket");

const DeleteService = {
  /**
   * Delete an ingredient and update meals that use it.
   * @param {*} ingredientId - The ID of the ingredient to delete.
   * @param {*} req - The request object, for translations and user context.
   * @param {*} next - The `next` function for error forwarding.
   * @returns - The deleted ingredient.
   */
  async deleteIngredient(ingredientId, req, next) {
    // Find and delete the ingredient
    const ingredient = await Ingredient.findOneAndDelete({
      _id: ingredientId,
      user: req.user._id,
    });

    if (!ingredient) {
      return next(new AppError(req.t("meals:error.ingredientNotFound"), 404));
    }

    // Find all meals that used the deleted ingredient and update them
    DeleteService.deleteIngredientsFromMeals(ingredientId, req);
  },

  /**
   * Update meals that use the given ingredient.
   * @param {Object} ingredientId - The ingredient ID to delete from meals.
   * @param {Object} req - The request object, for translations and user context.
   */
  async deleteIngredientsFromMeals(ingredientId, req) {
    // Find all meals that used the deleted ingredient
    const mealsToUpdate = await Meal.find({
      user: req.user._id,
      "ingredients.ingredientId": ingredientId,
    });

    for (const meal of mealsToUpdate) {
      // Filter out the ingredient to delete
      meal.ingredients = meal.ingredients.filter(
        (ingredient) => ingredient.ingredientId.toString() !== ingredientId,
      );

      // Recalculate the total nutrition info for the meal
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

    // Send message to clients if meals were updated
    if (Array.isArray(mealsToUpdate) && mealsToUpdate.length > 0) {
      sendMessageToClients(req.user._id, "ingredient_deleted_from_meals");
    }
  },
};

module.exports = DeleteService;
