const AppError = require("../utils/appError");

/**
 * Handle invalid CastErrorDB error
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

/**
 * Handle duplicate fields error
 */
const handleDuplicateFieldsDB = (err) => {
  console.log(err);
  const field = Object.keys(err.keyValue)[0]; // Extract the field causing the duplication
  const value = err.keyValue[field]; // Extract the duplicated value
  const message = `${field} with value "${value}" already exists. Please use another value!`;
  return new AppError(message, 400);
};

/**
 * Handle validation error
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => ({
    field: el.path,
    message: el.message,
    kind: el.kind,
    value: el.value,
  }));
  const message = "Validation failed. Please check the input data.";
  return new AppError(message, 400, errors);
};

/**
 * Handle invalid JWT error
 */
const handleJWTError = (err) =>
  new AppError("Invalid token. Please log in again!", 401);

/**
 * Handle expired JWT error
 */
const handleJWTExpiredError = (err) =>
  new AppError("Your token has expired! Please log in again.", 401);

/**
 * Send error in development mode
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

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

  // Send error in development
  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);

    // Send error in production
  } else if (process.env.NODE_ENV === "production") {
    let error = err;

    // Handle Stripe errors
    if (err.type && err.type.includes("Stripe")) error = handleStripeError(err);

    // Handle invalid CastErrorDB error
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);

    // Handle validation error
    if (error.name === "ValidationError")
      error = handleValidationErrorDB(error);

    // Handle CastErrorDB error
    if (error.name === "CastError") error = handleCastErrorDB(error);

    // Handle invalid JWT error
    if (error.name === "JsonWebTokenError") error = handleJWTError(error);

    // Handle expired JWT error
    if (error.name === "TokenExpiredError")
      error = handleJWTExpiredError(error);
    // Send error
    sendErrorProd(error, res);
  }
};
