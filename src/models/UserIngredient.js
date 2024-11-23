const mongoose = require("mongoose");

const ingredientSchema = new mongoose.Schema({
  title: {
    lt: {
      type: String,
      required: true,
    },
    en: {
      type: String,
      required: true,
    },
  },
  unit: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  calories: {
    type: Number,
    required: true,
  },
  protein: {
    type: Number,
    required: true,
  },
  fat: {
    type: Number,
    required: true,
  },
  carbs: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const userIngredientSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  lang: {
    type: String,
    default: "en",
  },
  ingredients: [ingredientSchema],
});

const UserIngredient = mongoose.model("UserIngredient", userIngredientSchema);

module.exports = UserIngredient;
