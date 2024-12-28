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
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive",
    },
    nutrition: {
      calories: {
        type: Number,
        default: 0,
      },
      protein: {
        type: Number,
        default: 0,
      },
      fat: {
        type: Number,
        default: 0,
      },
      carbs: {
        type: Number,
        default: 0,
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
            mealId: {
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
