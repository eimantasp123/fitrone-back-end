const Support = require("../models/Support");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

exports.support = catchAsync(async (req, res, next) => {
  console.log(req.body);
  const { message, subject, email, name } = req.body;
  if (!message || !subject) {
    return next(new AppError("Please provide message and subject", 400));
  }
  // Create message
  const support = await Support.create({
    name,
    email,
    message,
    subject,
    user: req.user._id,
  });

  support.save();
  return res.status(200).json({
    status: "success",
    message: "Message submitted successfully!",
  });
});
