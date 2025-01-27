require("dotenv").config(); // Load environment variables

// Require dependencies
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
const i18next = require("i18next");
const Backend = require("i18next-fs-backend");
const middleware = require("i18next-http-middleware");
const path = require("path");
const http = require("http");

// Require custom modules
const connectDB = require("./config/dbConfig");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const mealsRoutes = require("./routes/mealsRoutes");
const User = require("./models/User");
const Customer = require("./models/Customer");
const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/errorController");
const supportRoutes = require("./routes/supportRoutes");
const mealPlanRoutes = require("./routes/mealPlanRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const ingredientsRoutes = require("./routes/ingredientsRoutes");
const weekPlanRoutes = require("./routes/weekPlanRoutes");
const weeklyMenuRoutes = require("./routes/weeklyMenuRoutes");
const webhookRoutes = require("./utils/webhookRoutes");
const customerRoutes = require("./routes/customerRoutes");
const groupsRoutes = require("./routes/groupsRoutes");
const { initWebSocketServer } = require("./utils/websocket");

// Initialize i18next for localization
i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: "en",
    preload: ["en", "lt"], // Add all supported languages here
    defaultNS: "common",
    ns: [
      "common",
      "auth",
      "profile",
      "meals",
      "weeklyMenu",
      "weekPlan",
      "customers",
      "groups",
    ],
    backend: {
      loadPath: path.join(__dirname, "/locales/{{lng}}/{{ns}}.json"),
    },
    detection: {
      order: ["header", "querystring", "cookie"],
      caches: ["cookie"],
    },
    interpolation: {
      escapeValue: false, // Disable HTML escaping globally
    },
  });

// Initialize express app
const app = express();
const server = http.createServer(app);

// Initialize WebSocket server
initWebSocketServer(server);

// Use the i18next middleware to attach `req.t` function to requests
app.use(middleware.handle(i18next));

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
  // origin: process.env.FRONTEND_URL,
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
app.use("/api/v1/week-plan", weekPlanRoutes);
app.use("/api/v1/weekly-menu", weeklyMenuRoutes);
app.use("/api/v1/meals", mealsRoutes);
app.use("/api/v1/ingredients", ingredientsRoutes);
app.use("/api/v1/subscription", subscriptionRoutes);
app.use("/api/v1/customers", customerRoutes);
app.use("/api/v1/groups", groupsRoutes);
app.use("/api/v1/support", supportRoutes);
app.use("/api/v1/feedback", feedbackRoutes);
//
app.use("/api/v1/meal-plan", mealPlanRoutes);

// Error handling for invalid routes
app.all("*", (req, res, next) => {
  next(
    new AppError(
      req.t("error.cannotFindThisUrlOnServer", {
        url: req.originalUrl,
      }),
      404,
    ),
  );
});

// Global error handling middleware
app.use(globalErrorHandler);

// Start server
const PORT = process.env.PORT || 5000;
// app.listen(process.env.PORT);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

// Cleanup expired two-factor codes and reset password tokens every hour
cron.schedule("0 0 * * * *", async () => {
  try {
    // Remove two-factor codes and expires for users with expired codes
    await User.updateMany(
      { twoFactorExpires: { $lt: new Date() } },
      { $unset: { twoFactorCode: null, twoFactorExpires: null } },
    );
    // Remove reset password tokens and expires for users with expired tokens
    await User.updateMany(
      { resetPasswordExpires: { $lt: new Date() } },
      {
        $unset: {
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      },
    );
    // Remove email verification codes and expires for users with expired codes
    await User.updateMany(
      { emailVerificationExpires: { $lt: new Date() } },
      {
        $unset: {
          emailVerificationCode: null,
          emailVerificationExpires: null,
        },
      },
    );
    // Remove token from customers
    await Customer.updateMany(
      { confirmFormTokenExpires: { $lt: new Date() } },
      {
        $unset: {
          confirmFormToken: null,
          tokenExpconfirmFormTokenExpiresires: null,
        },
      },
    );
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
});

module.exports = app;
