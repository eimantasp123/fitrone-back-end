const morgan = require("morgan");
const responseTime = require("response-time");

// Determine the environment
const isDev = process.env.NODE_ENV === "development";

// Middleware to measure response time (only applied in production)
const responseTimeMiddleware = isDev
  ? (req, res, next) => next()
  : responseTime();

// Function to get User ID or mark as "Guest"
morgan.token("user", (req) => (req.user ? req.user.id : "Guest"));

// Log format: Includes Date, IP, User ID, Method, URL, Status, Response Time
const logFormat = isDev
  ? ":method :url :status :res[content-length]B - :response-time ms - User: :user"
  : ":date[iso] - :remote-addr - User: :user - [:method] :url → :status :res[content-length]B - :response-time ms";

const logger = morgan(logFormat);

module.exports = {
  responseTimeMiddleware,
  logger,
};
