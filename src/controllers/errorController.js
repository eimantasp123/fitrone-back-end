const AppError = require("../utils/appError");
const mongoose = require("mongoose");

/**
 * Handle invalid CastErrorDB error
 */
const handleCastErrorDB = (err, req) => {
  const message = req.t("validationErrors.invalidField", {
    field: err.path,
    value: err.value,
  });
  return new AppError(message, 400);
};
/**
 * Handle duplicate fields error
 */
const handleDuplicateFieldsDB = (err, req) => {
  // Check if keyValue exists and has at least one field
  if (err.keyValue && Object.keys(err.keyValue).length > 0) {
    const field = Object.keys(err.keyValue)[0]; // Extract the first field causing the duplication
    const value = err.keyValue[field]; // Extract the duplicated value

    // Generate a localized error message
    const message = req.t("validationErrors.duplicateTitleGeneral", { value });
    return new AppError(message, 400);
  }
  // Fallback for unexpected error formats
  console.error("Unexpected duplicate key error format:", err);
  return new AppError(req.t("validationErrors.unexpectedError"), 500);
};

/**
 * Handle validation error
 */
const handleValidationErrorDB = (err, req) => {
  // Check if the error is a validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((item) => {
      const dynamicValues = {};

      // Check if the error is a required field error
      if (item.kind === "maxlength")
        dynamicValues.max = item.properties.maxlength;
      if (item.kind === "minlength")
        dynamicValues.min = item.properties.minlength;

      // Generate a localized error message
      const errorMessage = req.t(
        `validationErrors.${item.message}`,
        dynamicValues,
      );

      // Return the error message
      return { message: errorMessage };
    });
    return new AppError(errors[0].message, 400);
  }

  // Fallback for unexpected error formats
  console.error("Unexpected validation error format:", err);
  return new AppError(req.t("validationErrors.unexpectedError"), 500);
};

/**
 * Handle invalid JWT error
 */
const handleJWTError = (req) => new AppError(req.t("error.invalidToken"), 401);

/**
 * Handle expired JWT error
 */
const handleJWTExpiredError = (req) =>
  new AppError(req.t("error.tokenExpired"), 401);

/**
 * Handle Stripe errors
 */
const handleStripeError = (err) => {
  let message;
  switch (err.type) {
    case "StripeCardError":
      // A declined card error
      message = err.message || "Your card was declined.";
      break;
    case "StripeInvalidRequestError":
      // Invalid parameters were supplied to Stripe's API
      message = "Invalid payment method or request parameters.";
      break;
    case "StripeAPIError":
      // An error occurred internally with Stripe's API
      message =
        "There was an error processing your payment. Please try again later.";
      break;
    case "StripeConnectionError":
      // Some kind of connection error occurred
      message = "There was a network error. Please try again later.";
      break;
    case "StripeAuthenticationError":
      // You probably used an incorrect API key
      message =
        "Authentication with the payment provider failed. Please try again later.";
      break;
    default:
      message = "An error occurred while processing your payment.";
  }
  return new AppError(message, 400);
};

/**
 * Send error in development mode
 */
const sendErrorDev = (error, errGlobal, res) => {
  res.status(error.statusCode).json({
    status: error.status,
    message: error.message,
    error: errGlobal,
    stack: error.stack,
  });
};

/**
 * Send error in production mode
 */
const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    // Operational error: trusted error we send to the client
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or other unknown error: don't leak details to the client
    console.error("ERROR 💥", err);
    res.status(500).json({
      status: "error",
      message: "Something went very wrong!",
    });
  }
};

/**
 * Error handler middleware
 */
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  let error = err;

  // Handle Stripe errors
  if (error.type && error.type.includes("Stripe"))
    error = handleStripeError(error, req);

  // Handle invalid CastErrorDB error
  if (error.code === 11000) error = handleDuplicateFieldsDB(error, req);

  // Handle validation error
  if (error.name === "ValidationError")
    error = handleValidationErrorDB(error, req);

  // Handle CastErrorDB error
  if (error.name === "CastError") error = handleCastErrorDB(error, req);

  // Handle invalid JWT error
  if (error.name === "JsonWebTokenError") error = handleJWTError(req);

  // Handle expired JWT error
  if (error.name === "TokenExpiredError") error = handleJWTExpiredError(req);
  // Send error

  // Send error in development
  if (process.env.NODE_ENV === "development") {
    sendErrorDev(error, err, res);

    // Send error in production
  } else if (process.env.NODE_ENV === "production") {
    sendErrorProd(error, res);
  }
};
