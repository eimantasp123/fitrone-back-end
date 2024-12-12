const Support = require("../models/Support");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

/**
 * Send a support message.
 */
exports.support = catchAsync(async (req, res, next) => {
  const { message, subject, email, name } = req.body;

  // Check if the required fields are provided
  if (!message || !subject) {
    return next(new AppError(req.t("error.missingMessageOrSubject"), 400));
  }

  // Create message and save it
  const support = await Support.create({
    name,
    email,
    message,
    subject,
    user: req.user._id,
  });
  support.save();

  // Send response
  return res.status(200).json({
    status: "success",
    message: req.t("supportMessageSent"),
  });
});
