// Mock mongoose fully before any require statements
jest.mock("mongoose", () => {
  const mockSchema = jest.fn(function (schemaDef) {
    this.schemaDef = schemaDef; // Store schema definition for debugging if needed
  });
  mockSchema.Types = {
    ObjectId: jest.fn(() => ({ toString: () => "mocked-id" })),
  };
  return {
    Schema: mockSchema,
    model: jest.fn(() => ({})),
    Types: mockSchema.Types,
  };
});

jest.mock("../src/models/WeeklyPlan");
jest.mock("../src/models/SingleDayOrder");
jest.mock("../src/models/WeeklyMenu");
jest.mock("../src/models/User");
const WeeklyPlan = require("../src/models/WeeklyPlan");
const SingleDayOrder = require("../src/models/SingleDayOrder");
const WeeklyMenu = require("../src/models/WeeklyMenu");
const User = require("../src/models/User");

const {
  updateWeeklyPlanAndSetExpired,
  updateWeeklyPlanAndSetExpiredForUsers,
  isMondayMidnight,
  processWeeklyPlans,
} = require("../src/crons/updateWeeklyPlanAndSetExpired");

describe("Weekly Plan Management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("updateWeeklyPlanAndSetExpired", () => {
    test("should update expired weekly plans and create snapshots", async () => {
      const userId = "mocked-id";
      const mockWeeklyPlan = {
        user: userId,
        year: 2025,
        weekNumber: 1,
        status: "active",
        assignMenu: [{ menu: { title: "Test Menu" } }],
        save: jest.fn().mockResolvedValue(true),
      };

      WeeklyPlan.find.mockResolvedValue([mockWeeklyPlan]);
      SingleDayOrder.find.mockResolvedValue([]);
      WeeklyMenu.updateMany.mockResolvedValue({ modifiedCount: 0 });

      await updateWeeklyPlanAndSetExpired(userId);

      expect(WeeklyPlan.find).toHaveBeenCalled();
      expect(mockWeeklyPlan.status).toBe("expired");
      expect(mockWeeklyPlan.isSnapshot).toBe(true);
      expect(mockWeeklyPlan.save).toHaveBeenCalled();
    });

    test("should handle errors gracefully", async () => {
      const userId = "mocked-id";
      WeeklyPlan.find.mockRejectedValue(new Error("Database error"));

      await expect(
        updateWeeklyPlanAndSetExpired(userId),
      ).resolves.toBeUndefined();
    });
  });

  describe("updateWeeklyPlanAndSetExpiredForUsers", () => {
    test("should process multiple users", async () => {
      const userIds = [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
      ];

      const mockUpdate = jest
        .spyOn(
          require("../src/crons/updateWeeklyPlanAndSetExpired"),
          "updateWeeklyPlanAndSetExpired",
        )
        .mockResolvedValue();

      await updateWeeklyPlanAndSetExpiredForUsers(userIds);

      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockUpdate).toHaveBeenCalledWith(userIds[0]);
      expect(mockUpdate).toHaveBeenCalledWith(userIds[1]);
    });
  });

  describe("isMondayMidnight", () => {
    test("should return true for Monday 00:00", () => {
      const mockDate = new Date("2025-03-03T00:00:00Z"); // Monday
      jest.setSystemTime(mockDate);

      const result = isMondayMidnight("UTC", mockDate);
      expect(result).toBe(true);
    });

    test("should return false for other times", () => {
      const mockDate = new Date("2025-03-03T01:00:00Z"); // Monday 1 AM
      jest.setSystemTime(mockDate);

      const result = isMondayMidnight("UTC", mockDate);
      expect(result).toBe(false);
    });
  });

  // Other describe blocks remain similar, just adjust userId to "mocked-id"
  describe("processWeeklyPlans", () => {
    test("should process users in correct timezone on Monday midnight", async () => {
      const mockUsers = [
        { _id: new mongoose.Types.ObjectId(), timezone: "UTC" },
        { _id: new mongoose.Types.ObjectId(), timezone: "America/New_York" },
      ];

      User.find.mockResolvedValue(mockUsers);

      const mockDate = new Date("2025-03-03T00:00:00Z"); // Monday UTC
      jest.setSystemTime(mockDate);

      const mockUpdateForUsers = jest
        .spyOn(
          require("../src/crons/updateWeeklyPlanAndSetExpired"),
          "updateWeeklyPlanAndSetExpiredForUsers",
        )
        .mockResolvedValue();

      await processWeeklyPlans();

      expect(User.find).toHaveBeenCalledWith({
        timezone: { $ne: null },
        role: "supplier",
      });
      expect(mockUpdateForUsers).toHaveBeenCalledWith([mockUsers[0]._id]);
    });

    test("should skip update if not Monday midnight", async () => {
      const mockUsers = [
        { _id: new mongoose.Types.ObjectId(), timezone: "UTC" },
      ];

      User.find.mockResolvedValue(mockUsers);

      const mockDate = new Date("2025-03-04T00:00:00Z"); // Tuesday UTC
      jest.setSystemTime(mockDate);

      const mockUpdateForUsers = jest
        .spyOn(
          require("../src/crons/updateWeeklyPlanAndSetExpired"),
          "updateWeeklyPlanAndSetExpiredForUsers",
        )
        .mockResolvedValue();

      await processWeeklyPlans();

      expect(mockUpdateForUsers).not.toHaveBeenCalled();
    });
  });
});

// Mock implementations
WeeklyPlan.find.mockImplementation(() => ({
  populate: jest.fn().mockReturnThis(),
  then: jest.fn((resolve) => resolve([])),
}));

SingleDayOrder.find.mockImplementation(() => ({
  populate: jest.fn().mockReturnThis(),
  then: jest.fn((resolve) => resolve([])),
}));

WeeklyMenu.updateMany.mockResolvedValue({ modifiedCount: 0 });

User.find.mockImplementation(() => ({
  select: jest.fn().mockReturnThis(),
  then: jest.fn((resolve) => resolve([])),
}));
