import User from "./model/User.js";
import WeekPlan from "./model/WeekPlan.js";
import WeeklyMenu from "./model/WeeklyMenu.js";
import mongoose from "mongoose";
import { getWeek, getYear } from "date-fns";
import AWS from "aws-sdk";

const secretsManager = new AWS.SecretsManager();
let isConnected = false;

// Connect to MongoDB Securely
const connectDB = async () => {
  if (isConnected) return;

  const secret = await secretsManager
    .getSecretValue({ SecretId: process.env.MONGO_DB_SECRET })
    .promise();
  const MONGO_URI = JSON.parse(secret.SecretString).MONGO_URI;

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // 5 seconds to fail faster
    });

    isConnected = true;
  } catch (error) {
    throw new Error("MongoDB Connection Error: " + error.message);
  }
};

// Lambda Handler to Process Expired Week Plans and Weekly Menus
export const handler = async () => {
  await connectDB();

  // Get the current year and week number in UTC time
  const now = new Date();
  const currentYear = getYear(now);
  const currentWeek = getWeek(now);

  // Calculate the minimum week to expire (last 4 weeks)
  const minExpiredWeek = currentWeek - 4;
  const minExpiredYear = minExpiredWeek > 0 ? currentYear : currentYear - 1;
  const adjustedWeek =
    minExpiredWeek > 0 ? minExpiredWeek : 52 + minExpiredWeek; // Handle negative week values (previous year)

  // Expire Week Plans from the last 4 weeks only
  await WeekPlan.updateMany(
    {
      $or: [
        { year: { $lt: minExpiredYear } }, // Expire past years
        {
          year: minExpiredYear,
          weekNumber: { $gte: adjustedWeek, $lt: currentWeek },
        }, // Expire past 4 weeks in the last year
        { year: currentYear, weekNumber: { $lt: currentWeek } }, // Expire past weeks in current year
      ],
    },
    { $set: { status: "expired", isSnapshot: true } },
  );

  // Remove expired weeks from WeeklyMenu
  await WeeklyMenu.updateMany(
    {
      $or: [
        { "activeWeeks.year": { $lt: minExpiredYear } },
        {
          "activeWeeks.year": minExpiredYear,
          "activeWeeks.weekNumber": { $gte: adjustedWeek, $lt: currentWeek },
        },
        {
          "activeWeeks.year": currentYear,
          "activeWeeks.weekNumber": { $lt: currentWeek },
        },
      ],
    },
    {
      $pull: {
        activeWeeks: {
          $or: [
            { year: { $lt: minExpiredYear } },
            {
              year: minExpiredYear,
              weekNumber: { $gte: adjustedWeek, $lt: currentWeek },
            },
            { year: currentYear, weekNumber: { $lt: currentWeek } },
          ],
        },
      },
    },
  );

  // Set `inactive` for menus with empty `activeWeeks`
  await WeeklyMenu.updateMany(
    { activeWeeks: { $size: 0 } }, // If `activeWeeks` array is now empty
    { $set: { status: "inactive" } },
  );
};
