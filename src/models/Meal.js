const mongoose = require("mongoose");

const mealSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxLength: 70,
    },
    description: {
      type: String,
      trim: true,
      maxLength: 500,
    },
    image: {
      type: String,
      default: "https://fitronelt.s3.eu-north-1.amazonaws.com/cb169cd415.jpg",
    },
    ingredients: [
      {
        ingredientId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Ingredient",
          required: true,
        },
        title: { type: String, required: true, lowercase: true },
        currentAmount: { type: Number, required: true },
        unit: { type: String, required: true },
        calories: { type: Number, required: true },
        protein: { type: Number, required: true },
        fat: { type: Number, required: true },
        carbs: { type: Number, required: true },
      },
    ],
    nutrition: {
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
    },
    preferences: {
      type: [String],
      default: [],
      enum: {
        values: [
          "vegetarian",
          "vegan",
          "pescatarian",
          "flexitarian",
          "paleo",
          "keto",
          "lowCarb",
          "mediterranean",
          "highProtein",
          "plantBased",
          "balanced",
          "spicy",
          "sweet",
        ],
        message: "invalidPreference",
      },
    },
    restrictions: {
      type: [String],
      default: [],
      enum: {
        values: [
          "glutenFree",
          "dairyFree",
          "nutFree",
          "eggFree",
          "soyFree",
          "shellfishFree",
          "halal",
          "kosher",
          "lowSodium",
          "sugarFree",
        ],
        message: "invalidRestriction",
      },
    },
    category: {
      type: String,
      required: true,
      enum: {
        values: [
          "breakfast",
          "lunch",
          "dinner",
          "snack",
          "drink",
          "dessert",
          "other",
        ],
        message: "invalidCategory",
      },
    },
    archived: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

mealSchema.index(
  {
    user: 1,
    title: 1,
  },
  { partialFilterExpression: { deletedAt: null } },
);
mealSchema.index(
  {
    user: 1,
    archived: 1,
    createdAt: -1,
  },
  { partialFilterExpression: { deletedAt: null } },
);
mealSchema.index(
  { user: 1, archived: 1, title: 1, createdAt: -1 },
  { partialFilterExpression: { deletedAt: null } },
);
mealSchema.index(
  { user: 1, "ingredients.ingredientId": 1 },
  { partialFilterExpression: { deletedAt: null } },
);

const Meal = mongoose.model("Meal", mealSchema);

module.exports = Meal;
