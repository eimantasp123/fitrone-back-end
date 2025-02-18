const mongoose = require("mongoose");

const weeklyPlanSchema = new mongoose.Schema(
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
        menuSnapshot: {
          type: Object,
          default: null,
        },
        published: {
          type: Boolean,
          default: false,
        },
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

// Indexes
weeklyPlanSchema.index({ user: 1, _id: 1 });

const WeeklyPlan = mongoose.model("WeeklyPlan", weeklyPlanSchema);
module.exports = WeeklyPlan;
