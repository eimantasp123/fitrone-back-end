const mongoose = require("mongoose");

const singleDayOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userRequired"],
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
    status: {
      type: String,
      enum: ["not_done", "done"],
      default: "not_done",
    },
    expired: {
      type: Boolean,
      default: false,
    },
    categories: [
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
        meals: [
          {
            meal: {
              type: Object,
              required: true,
            },
            weeklyMenu: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "WeeklyMenu",
              required: true,
            },
            weeklyMenuTitle: {
              type: String,
            },
            status: {
              type: String,
              enum: ["not_done", "done", "preparing"],
              default: "not_done",
            },
            customers: [
              {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Customer",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    timestamps: true,
  },
);

const SingleDayOrder = mongoose.model("SingleDayOrder", singleDayOrderSchema);
module.exports = SingleDayOrder;
