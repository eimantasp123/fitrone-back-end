const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

/**
 *  Send feedback to the application
 */
exports.createOrder = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: "success",
    message: "Order created successfully",
  });
});
