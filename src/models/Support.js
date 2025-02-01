const mongoose = require("mongoose");

// Define the schema for feedback
const supportSchema = new mongoose.Schema(
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
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, "Subject must be less than 200 characters long"],
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

const Support = mongoose.model("Support", supportSchema);
module.exports = Support;
