const AppError = require("../utils/appError");

// Handle invalid CastErrorDB error
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

// Handle duplicate fields error
const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `${value} already exists. Please use another value!`;
  return new AppError(message, 400);
};

// Handle validation error
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, 400);
};

// Handle invalid JWT error
const handleJWTError = (err) =>
  new AppError("Invalid token. Please log in again!", 401);

// Handle expired JWT error
const handleJWTExpiredError = (err) =>
  new AppError("Your token has expired! Please log in again.", 401);

// Send error in development mode
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

// Send error in production mode
const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    console.error("ERROR 💥", err);
    res.status(500).json({
      status: "error",
      message: "Something went very wrong!",
    });
  }
};

// Export error handler middleware
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Send error in development
  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);

    // Send error in production
  } else if (process.env.NODE_ENV === "production") {
    let error = err;
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
