const { isWeekExpired } = require("../src/helper/dataHelpers");

describe("isWeekExpired", () => {
  const testCases = [
    {
      timezone: "Europe/Vilnius",
      currentDate: "2025-03-24T00:00:00Z", // Monday 2 AM local (week 13)
      year: 2025,
      week: 12,
      expected: true,
    },
    {
      timezone: "Europe/Vilnius",
      currentDate: "2025-03-24T00:00:00Z", // Monday 2 AM local (week 13)
      year: 2025,
      week: 13,
      expected: false,
    },
    {
      timezone: "Europe/Vilnius",
      currentDate: "2025-03-24T00:00:00Z", // Monday 2 AM local (week 13)
      year: 2025,
      week: 14,
      expected: false,
    },
    {
      timezone: "Europe/Vilnius",
      currentDate: "2025-03-26T00:00:00Z", // Wednesday 2 AM local (week 13)
      year: 2025,
      week: 13,
      expected: false,
    },
    {
      timezone: "Europe/Vilnius",
      currentDate: "2025-03-26T00:00:00Z", // Wednesday 2 AM local (week 13)
      year: 2025,
      week: 12,
      expected: true,
    },
    {
      timezone: "Europe/Vilnius",
      currentDate: "2025-03-26T00:00:00Z", // Wednesday 2 AM local (week 13)
      year: 2025,
      week: 11,
      expected: true,
    },
    {
      timezone: "America/New_York",
      currentDate: "2025-03-24T04:00:00Z", // still Sunday local
      year: 2025,
      week: 13,
      expected: false,
    },
    {
      timezone: "Asia/Tokyo",
      currentDate: "2025-03-23T23:00:00Z",
      year: 2025,
      week: 12,
      expected: true,
    },
    {
      timezone: "UTC",
      currentDate: "2025-03-17T00:00:00Z",
      year: 2025,
      week: 12,
      expected: false,
    },
    {
      timezone: "Europe/London",
      currentDate: "2025-03-31T08:00:00Z", // Monday, week 14 local
      year: 2025,
      week: 13,
      expected: true,
    },
    {
      timezone: "Europe/London",
      currentDate: "2025-03-31T08:00:00Z", // Monday, week 14
      year: 2025,
      week: 14,
      expected: false,
    },
    {
      timezone: "Australia/Sydney",
      currentDate: "2025-03-30T10:00:00Z", // Sunday night local
      year: 2025,
      week: 13,
      expected: false,
    },
    {
      timezone: "Australia/Sydney",
      currentDate: "2025-03-31T00:30:00Z", // Monday 11:30 AM local
      year: 2025,
      week: 13,
      expected: true,
    },
    {
      timezone: "America/Los_Angeles",
      currentDate: "2025-03-24T07:00:00Z", // Sunday 11:59 PM PT
      year: 2025,
      week: 13,
      expected: false,
    },
    {
      timezone: "America/Los_Angeles",
      currentDate: "2025-03-25T07:00:00Z", // Tuesday week 13
      year: 2025,
      week: 13,
      expected: false,
    },
    {
      timezone: "America/Los_Angeles",
      currentDate: "2025-03-31T07:00:00Z", // Monday week 14
      year: 2025,
      week: 13,
      expected: true,
    },
  ];

  testCases.forEach(({ timezone, currentDate, year, week, expected }) => {
    it(`returns ${expected} for year=${year}, week=${week}, timezone=${timezone}, now=${currentDate}`, () => {
      const mockNow = new Date(currentDate);
      const result = isWeekExpired(year, week, timezone, mockNow);
      expect(result).toBe(expected);
    });
  });
});
