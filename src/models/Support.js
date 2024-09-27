const mongoose = require("mongoose");

// Define the schema for feedback
const supportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
    maxlength: [200, "Subject must be less than 200 characters long"],
  },
  message: {
    type: String,
    required: true,
    maxlength: [500, "Message must be less than 500 characters long"],
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Support = mongoose.model("Support", supportSchema);

module.exports = Support;
