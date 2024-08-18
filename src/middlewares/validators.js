// validators.js
const { body } = require("express-validator");

const updateProfileValidationRules = [
  body("data.firstName").optional().isString().withMessage("First Name must be a string"),
  body("data.lastName").optional({ nullable: true, checkFalsy: true }).isString().withMessage("Last Name must be a string"),
  body("data.email").optional().isEmail().withMessage("Invalid email address"),
  body("data.phone")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage("Invalid phone number"),
];

const updateProfilePasswordValidationRules = [
  body("oldPassword")
    .notEmpty()
    .withMessage("Old password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
  body("confirmNewPassword")
    .notEmpty()
    .withMessage("Confirm new password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage("Passwords do not match"),
];

module.exports = {
  updateProfileValidationRules,
  updateProfilePasswordValidationRules,
};
