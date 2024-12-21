const mongoose = require("mongoose");

const WeeklyMenuSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userRequired"],
    },
    title: {
      type: String,
      required: [true, "titleRequired"],
      maxlength: [100, "titleMustBeLessThan"],
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      lowercase: true,
      maxlength: [500, "descriptionMustBeLessThan"],
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
    days: [
      {
        day: {
          type: Number,
          required: true,
          min: [0, "Invalid day"],
          max: [6, "Invalid day"],
        },
        meals: [
          {
            category: {
              type: String,
              required: true,
              enum: [
                "breakfast",
                "lunch",
                "dinner",
                "snack",
                "drink",
                "dessert",
                "other",
              ],
            },
            meal: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Meal",
              required: true,
            },
            time: {
              type: String,
            },
          },
        ],
      },
    ],
  },
  { timestamps: true },
);

// Define a compound index to ensure unique titles per user
WeeklyMenuSchema.index({ title: 1, user: 1 }, { unique: true });

// Automatically exclude __v and user when converting to JSON
WeeklyMenuSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.__v;
    delete ret.user;
    return ret;
  },
});

const WeeklyMenu = mongoose.model("WeeklyMenu", WeeklyMenuSchema);
module.exports = WeeklyMenu;
