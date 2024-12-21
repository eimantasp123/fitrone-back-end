const mongoose = require("mongoose");
const AppError = require("../utils/appError");

const weekPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userRequired"],
    },
    title: {
      type: String,
      required: true,
      required: [true, "titleRequired"],
      maxlength: [70, "titleMustBeLessThan"],
    },
    description: {
      type: String,
      maxlength: [500, "descriptionMustBeLessThan"],
    },
    restrictions: {
      type: [String],
      default: [],
    },
    preferences: {
      type: [String],
      default: [],
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    weekNumber: {
      type: Number,
      required: true,
      min: [1, "Invalid week number"],
      max: [53, "Invalid week number"],
    },
    year: {
      type: Number,
      required: true,
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
    assignedGroups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
      },
    ],
    assignedClients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
      },
    ],
  },
  { timestamps: true },
);

/**
 *  Validate the week plan before saving
 */
weekPlanSchema.pre("save", function (next) {
  if (this.startDate > this.endDate) {
    return next(new AppError("Start date must be before end date", 400));
  }
  if (this.title) {
    this.title = this.title.toLowerCase();
  }
  if (this.description) {
    this.description = this.description.toLowerCase();
  }
  next();
});

const WeekPlan = mongoose.model("WeekPlan", weekPlanSchema);
module.exports = WeekPlan;
