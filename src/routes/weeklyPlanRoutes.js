const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authController = require("../controllers/authController");
const router = express.Router();
const {
  setUserTimezone,
  assignMenu,
  assignClients,
  getWeeklyPlanByDateAndCreate,
  deleteAssignedMenu,
  managePublishMenu,
  checkWeeklyPlanAndMenuAssigned,
  removeClient,
  getWeeklyPlanAssignedMenuDetails,
} = require("../controllers/weeklyPlanController");
const checkWeeklyPlanMenu = require("../middlewares/checkWeeklyPlanMenu");

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);

// Restrict access to admin and supplier roles
router.use(
  authController.restrictTo({
    roles: ["admin", "supplier"],
    plans: ["basic", "pro", "premium"],
  }),
);

// Set user timezone
router.patch("/set-timezone", setUserTimezone);

// Get week plan by date and create on mount
router.get("/", getWeeklyPlanByDateAndCreate);

// Assign menu to weekly plan
router.patch("/:id/assign-menu", checkWeeklyPlanMenu, assignMenu);

// Delete assigned menu from weekly plan
router.delete("/delete-menu", deleteAssignedMenu);

// Assign client to weekly plan
router.patch(
  "/:id/assign-clients",
  checkWeeklyPlanAndMenuAssigned,
  assignClients,
);

// Remove client from weekly plan
router.patch(
  "/:id/remove-client",
  checkWeeklyPlanAndMenuAssigned,
  removeClient,
);

// Manage publish weekly plan menu
router.patch("/manage-publish-menu", managePublishMenu);

// Get weekly plan menu details
router.get("/:id/menu-details/:menuId", getWeeklyPlanAssignedMenuDetails);

module.exports = router;
