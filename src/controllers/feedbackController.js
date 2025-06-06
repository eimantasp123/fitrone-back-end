const Feedback = require("../models/Feedback");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

/**
 *  Send feedback to the application
 */
exports.feedback = catchAsync(async (req, res, next) => {
  const { comment, rating } = req.body;

  // Check if comment and rating are provided
  if (!comment || !rating) {
    return next(new AppError(req.t("error.missingCommentAndRating"), 400));
  }

  // Create feedback and save it
  const feedback = await Feedback.create({
    comment,
    rating,
    user: req.user._id,
  });

  feedback.save();

  // Send response
  return res.status(200).json({
    status: "success",
    message: req.t("feedbackMessageSent"),
  });
});
