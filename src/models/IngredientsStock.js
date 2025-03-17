const mongoose = require("mongoose");

const ingredientsStockSchema = new mongoose.Schema(
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
      min: 0,
      max: 6,
      default: null,
    },
    dayCombined: {
      type: [Number], // Array of numbers for days (0-6)
      default: null,
    },
    ingredients: [
      {
        ingredient: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Ingredient",
          required: true,
        },
        stockAmount: {
          type: Number,
          required: true,
        },
      },
    ],
  },
  { timestamps: true },
);

ingredientsStockSchema.index({ user: 1, year: 1, weekNumber: 1 });

const IngredientsStock = mongoose.model(
  "IngredientsStock",
  ingredientsStockSchema,
);

module.exports = IngredientsStock;
