require("dotenv").config();
//
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
//
const connectDB = require("./config/dbConfig");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const User = require("./models/User");
const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/errorController");

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Development logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Rate limiting
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour!",
});

// CORS options
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  methods: "GET, POST, PUT, DELETE, PATCH",
  credentials: true,
};

// Set security HTTP headers
app.use(helmet());

// Limit requests from same API (100 requests per hour)
app.use(limiter);

// Enable CORS for frontend access
app.use(cors(corsOptions));

// Body parser, reading data from body into req.body
app.use(express.json());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanaization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    // Allow duration parameter for sorting
    whitelist: ["duration"],
  }),
);

// Cookie parser middleware
app.use(cookieParser());

// Routes
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);

// Error handling for invalid routes
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handling middleware
app.use(globalErrorHandler);

// Start server
app.listen(process.env.PORT);

// Cleanup expired two-factor codes and reset password tokens every hour
cron.schedule("0 * * * *", async () => {
  try {
    // Remove two-factor codes and expires for users with expired codes
    await User.updateMany(
      { twoFactorExpires: { $lt: new Date() } },
      { $unset: { twoFactorCode: undefined, twoFactorExpires: undefined } },
    );
    // Remove reset password tokens and expires for users with expired tokens
    await User.updateMany(
      { resetPasswordExpires: { $lt: new Date() } },
      {
        $unset: {
          resetPasswordToken: undefined,
          resetPasswordExpires: undefined,
        },
      },
    );
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
});

module.exports = app;
