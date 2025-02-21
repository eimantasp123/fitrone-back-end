const mongoose = require("mongoose");

const ingredientStockSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    weekNumber: {
      type: Number,
      required: true,
    },
    day: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    ingredient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

const IngredientStock = mongoose.model(
  "IngredientStock",
  ingredientStockSchema,
);

module.exports = IngredientStock;
