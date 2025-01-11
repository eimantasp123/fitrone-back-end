const mongoose = require("mongoose");

const weekPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userRequired"],
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    assignMenu: [
      {
        menu: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "WeeklyMenu",
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
  },
  { timestamps: true },
);

const WeekPlan = mongoose.model("WeekPlan", weekPlanSchema);
module.exports = WeekPlan;
