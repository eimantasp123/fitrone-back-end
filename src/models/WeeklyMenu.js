const mongoose = require("mongoose");

const WeeklyMenuSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: [70, "Title must be less than 70 characters"],
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      lowercase: true,
      maxlength: [500, "Description must be less than 500 characters"],
      trim: true,
    },
    archived: {
      type: Boolean,
      default: false,
    },
    restrictions: {
      type: [String],
      default: [],
    },
    preferences: {
      type: [String],
      default: [],
    },
    meals: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Meal",
      },
    ],
  },
  { timestamps: true },
  { autoIndex: true },
);

// Ensure the user has only one weekly menu with the same title
WeeklyMenuSchema.index({ user: 1, title: 1 }, { unique: true });

const WeeklyMenu = mongoose.model("WeeklyMenu", WeeklyMenuSchema);
module.exports = WeeklyMenu;
