const mongoose = require("mongoose");

// Define the schema for feedback
const systemProblemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Name must be less than 100 characters long"],
    },
    email: {
      type: String,
      required: true,
    },
    problem: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, "Message must be less than 500 characters long"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

const SystemProblem = mongoose.model("SystemProblem", systemProblemSchema);
module.exports = SystemProblem;
