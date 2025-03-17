const mongoose = require("mongoose");

const ingredientSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userRequired"],
    },
    title: {
      type: String,
      required: [true, "titleRequired"],
      trim: true,
      lowercase: true,
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
    archived: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Indexes
ingredientSchema.index(
  { user: 1, title: 1 },
  { partialFilterExpression: { deletedAt: null } },
);

ingredientSchema.index(
  {
    user: 1,
    archived: 1,
    title: 1,
  },
  { partialFilterExpression: { deletedAt: null } },
);

ingredientSchema.index(
  {
    user: 1,
    archived: 1,
    createdAt: -1,
  },
  { partialFilterExpression: { deletedAt: null } },
);

const Ingredient = mongoose.model("Ingredient", ingredientSchema);

module.exports = Ingredient;
