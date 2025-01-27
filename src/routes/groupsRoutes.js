const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  createGroup,
  getAllGroups,
  deleteGroup,
  updateGroup,
  attachMembersToGroup,
} = require("../controllers/groupsController");
const router = express.Router();

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);

// Create a new customer manually
router.post("/", createGroup);

// Get all groups created by the user
router.get("/", getAllGroups);

// Delete a group
router.delete("/:groupId", deleteGroup);

// Update a group
router.patch("/:groupId", updateGroup);

// Attach members to group
router.post("/:groupId/add-customers", attachMembersToGroup);

module.exports = router;
