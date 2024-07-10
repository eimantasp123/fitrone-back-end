require("dotenv").config();
require("./config/passport");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const connectDB = require("./config/dbConfig");
const authRoutes = require("./routes/authRoutes");
const protectedRoutes = require("./routes/protectedRoutes");
const passport = require("passport");
const MongoStore = require("connect-mongo");
const verificationsRoutes = require("./routes/verificationsRoutes");

const app = express();
connectDB();

const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: "GET, POST, PUT, DELETE",
    credentials: true,
  })
);

// app.use((req, res, next) => {
//   console.log(`${req.method} ${req.url}`);
//   next();
// });

// Custom error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack); // Log the error stack trace for debugging

  // Send a generic error response to the client
  res.status(err.status || 500).json({
    message: err.message || "An unexpected error occurred",
  });
});

app.use(express.json());
app.use(cookieParser());
// Configure session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/auth", authRoutes);
app.use("/api", protectedRoutes);
app.use("/", verificationsRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
