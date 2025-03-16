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
    activeWeeks: [
      {
        year: { type: Number },
        weekNumber: { type: Number },
      },
    ],
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
            meal: {
              type: Object,
              required: true,
            },
          },
        ],
      },
    ],
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Indexes
WeeklyMenuSchema.index({ title: 1, user: 1 }, { unique: true });
WeeklyMenuSchema.index({ user: 1, _id: 1, deletedAt: 1 });
WeeklyMenuSchema.index({ user: 1, "days.meals.meal.image": 1 });

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
