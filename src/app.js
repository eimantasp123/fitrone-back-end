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
const feedbackRoutes = require("./routes/feedbackRoutes");
const User = require("./models/User");
const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/errorController");
const supportRoutes = require("./routes/supportRoutes");
const mealPlanRoutes = require("./routes/mealPlanRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const webhookRoutes = require("./utils/webhookRoutes");

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
  max: 500,
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

// Stripe webhook
app.use("/api/v1/webhook", webhookRoutes);

// Body parser, reading data from body into req.body
app.use(express.json());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanaization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    // Allow listed parameters for sorting
    whitelist: [""],
  }),
);

// Cookie parser middleware
app.use(cookieParser());

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/feedback", feedbackRoutes);
app.use("/api/v1/support", supportRoutes);
app.use("/api/v1/meal-plan", mealPlanRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/subscription", subscriptionRoutes);

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
    // Remove email verification codes and expires for users with expired codes
    await User.updateMany(
      { emailVerificationExpires: { $lt: new Date() } },
      {
        $unset: {
          emailVerificationCode: undefined,
          emailVerificationExpires: undefined,
        },
      },
    );
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
});

module.exports = app;
