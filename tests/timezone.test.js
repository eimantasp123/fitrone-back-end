const { isValidTimezone } = require("../src/helper/dataHelpers");

describe("Timezone Utilities", () => {
  const validTimezones = [
    "Europe/London",
    "Europe/Lisbon",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Madrid",
    "Europe/Rome",
    "Europe/Warsaw",
    "Europe/Vilnius",
    "Europe/Athens",
    "Europe/Bucharest",
    "Europe/Helsinki",
    "Europe/Istanbul",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Phoenix",
    "America/Los_Angeles",
    "America/Anchorage",
  ];

  const invalidTimezones = [
    "Invalid/Zone",
    "Europe/UnknownCity",
    "Tokyo", // Not an IANA format
    "1234",
  ];

  test.each(validTimezones)("isValidTimezone returns true for %s", (tz) => {
    expect(isValidTimezone(tz)).toBe(true);
  });

  test.each(invalidTimezones)("isValidTimezone returns false for %s", (tz) => {
    expect(isValidTimezone(tz)).toBe(false);
  });
});
