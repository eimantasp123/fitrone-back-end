const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes
groupSchema.index({ createdBy: 1, _id: 1 });

const Group = mongoose.model("Group", groupSchema);
module.exports = Group;
