require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/dbConfig");
const authRoutes = require("./routes/authRoutes");
const verificationRoutes = require("./routes/verificationRoutes");
const errorHandler = require("./middlewares/errorMiddleware");
const User = require("./models/User");

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

app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRoutes);
app.use("/", verificationRoutes);
// app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

cron.schedule("0 * * * *", async () => {
  console.log("Running cron job");
  try {
    await User.updateMany({ twoFactorExpires: { $lt: new Date() } }, { $unset: { twoFactorCode: "", twoFactorExpires: "" } });
    await User.updateMany(
      { resetPasswordExpires: { $lt: new Date() } },
      { $unset: { resetPasswordToken: "", resetPasswordExpires: "" } }
    );
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
});

module.exports = app;
