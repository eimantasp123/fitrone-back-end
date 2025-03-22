require("dotenv").config(); // Load environment variables

// Require dependencies
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
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
const compression = require("compression");
const { doubleCsrf } = require("csrf-csrf");

// Require custom modules
const connectDB = require("./config/dbConfig");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const mealsRoutes = require("./routes/mealsRoutes");
const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/errorController");
const supportRoutes = require("./routes/supportRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const ingredientsRoutes = require("./routes/ingredientsRoutes");
const weekPlanRoutes = require("./routes/weeklyPlanRoutes");
const weeklyMenuRoutes = require("./routes/weeklyMenuRoutes");
const webhookRoutes = require("./utils/webhookRoutes");
const customerRoutes = require("./routes/customerRoutes");
const ordersRoutes = require("./routes/ordersRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const { initWebSocketServer } = require("./utils/websocket");
const cron = require("node-cron");
const cleanupDatabase = require("./crons/cleanupDatabase");
const {
  processWeeklyPlans,
  processConfirmationFunctionForWeeklyPlan,
} = require("./crons/updateWeeklyPlanAndSetExpired");
const { logger, responseTimeMiddleware } = require("./logger");

// Initialize express app
const app = express(); // Create express app
app.set("trust proxy", 1); // Enable proxy trust
const server = http.createServer(app); // Create HTTP server
initWebSocketServer(server); // Initialize WebSocket server

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
      "weeklyPlan",
      "customers",
      "groups",
      "orders",
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

// CSRF protection middleware
const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || "fallback-token", // Secret key for CSRF token
  cookieName:
    process.env.NODE_ENV === "production"
      ? "__Host-psifi.x-csrf-token"
      : "csrf-token",
  cookieOptions: {
    httpOnly: process.env.NODE_ENV === "production",
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 1000, // 1 hour
  },
  size: 64, // The size of the generated tokens in bits
  ignoredMethods: ["GET", "HEAD", "OPTIONS"], // A list of request methods that will not be protected.
  getTokenFromRequest: (req) => req.headers["x-csrf-token"], // A function that returns the token from the request
});

app.use(middleware.handle(i18next)); // Use the i18next middleware to attach `req.t` function to requests
connectDB(); // Connect to database

// Use middleware functions for logging
app.use(responseTimeMiddleware);
app.use(logger);

// Auth Routes Limiter (Stricter)
const authLimiter = rateLimit({
  max: 50, // Allow 20 requests per 5 minutes
  windowMs: 5 * 60 * 1000, // 5 minutes
  message: "Too many login/signup requests, please try again later.",
});

// General API Limiter (More Requests Allowed)
const generalLimiter = rateLimit({
  max: 600, // 600 requests per 10 minutes
  windowMs: 10 * 60 * 1000, // 10 minutes
  message: "Too many requests, please slow down.",
});

// CORS options
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.BACKEND_URL,
      "https://hooks.stripe.com",
    ];
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  methods: "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token"],
};

app.use(cors(corsOptions)); // Enable CORS for frontend access
// Set security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"], // Blocks inline scripts
        objectSrc: ["'none'"], // Blocks Flash/ActiveX
      },
    },
  }),
);
app.use("/api/v1/webhook", webhookRoutes); // Stripe webhook
app.use(express.json()); // Body parser, reading data from body into req.body
app.use(compression()); // Compress all responses
app.use(mongoSanitize()); // Data sanitization against NoSQL query injection
app.use(xss()); // Data sanaization against XSS
app.use(hpp()); // Prevent parameter pollution
app.use(cookieParser()); // Cookie parser middleware

// CSRF protection middleware
app.use((req, res, next) => {
  doubleCsrfProtection(req, res, (err) => {
    if (err && err.code === "EBADCSRFTOKEN") {
      // Suppress CSRF error logging
      return res.status(403).json({
        success: false,
        message: "Invalid CSRF token. Please refresh the page or try again.",
        code: "EBADCSRFTOKEN",
      });
    }
    next(err);
  });
});

if (process.env.NODE_ENV === "development") {
  app.use("/pdf", express.static(path.join(__dirname, "../pdf"))); // Serve PDF files in development
}

// CSRF token generation route
app.get("/api/v1/csrf-token", authLimiter, (req, res) => {
  try {
    const csrfToken = generateToken(req, res, false, false);
    res.json({ csrfToken });
  } catch (error) {
    console.error("🔴 Error in CSRF token generation:", error);
    res.status(500).json({ error: "Failed to generate CSRF token" });
  }
});

// Apply auth limiter to auth routes
app.use("/api/v1/auth", authLimiter, authRoutes);

// Apply general limiter to all routes
app.use(generalLimiter);
app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/weekly-plan", weekPlanRoutes);
app.use("/api/v1/weekly-menu", weeklyMenuRoutes);
app.use("/api/v1/meals", mealsRoutes);
app.use("/api/v1/ingredients", ingredientsRoutes);
app.use("/api/v1/subscription", subscriptionRoutes);
app.use("/api/v1/customers", customerRoutes);
app.use("/api/v1/orders", ordersRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/support", supportRoutes);
app.use("/api/v1/feedback", feedbackRoutes);

// Run every day at midnight (00:15) to clean up the database
cron.schedule("15 0 * * *", async () => {
  try {
    await cleanupDatabase();
    console.log("✅ Database cleanup completed successfully.");
  } catch (error) {
    console.error("❌ Error in database cleanup:", error);
  }
});

// Run every Sunday and Monday at 15 minutes past each hour (e.g., 10:15, 11:15, etc.)
cron.schedule("15 * * * 0,1", async () => {
  try {
    await processWeeklyPlans();
    console.log("✅ Weekly plans processed successfully.");
  } catch (error) {
    console.error("❌ Error in processing weekly plans:", error);
  }
});

// Run every monday at 2:00 AM in UTC time to update weekly plans if was not updated
cron.schedule("0 2 * * 1", async () => {
  try {
    await processConfirmationFunctionForWeeklyPlan();
    console.log("✅ Weekly plans processed successfully.");
  } catch (error) {
    console.error("❌ Error in processing weekly plans:", error);
  }
});

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
const serverInstance = server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Error handling for uncaught exceptions (unexpected errors in the app)
process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:", err.message, err.stack);
  serverInstance.close(() => {
    process.exit(1); // Exit the process (prevents unexpected behavior)
  });
});

// Error handling for unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Rejection:", reason);
  serverInstance.close(() => {
    process.exit(1); // Exit the process (prevents unexpected behavior)
  });
});
