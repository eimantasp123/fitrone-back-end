const mongoose = require("mongoose");

const weekPlanSchema = new mongoose.Schema(
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
    assignMenu: [
      {
        menu: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "WeeklyMenu",
        },
        published: {
          type: Boolean,
          default: false,
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
    ],
    isSnapshot: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "expired"],
      default: "active",
    },
  },
  { timestamps: true },
);

const WeekPlan = mongoose.model("WeekPlan", weekPlanSchema);
module.exports = WeekPlan;
