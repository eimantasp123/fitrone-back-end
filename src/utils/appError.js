class AppError extends Error {
  constructor(message, statusCode, erros = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.errors = erros;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
