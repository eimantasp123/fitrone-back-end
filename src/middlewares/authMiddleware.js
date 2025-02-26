const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const authMiddleware = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  const token = req.cookies.accessToken;
  if (!token) return next(new AppError(req.t("pleaseLoginAgain"), 401));

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError(req.t("error.tokenNotExists"), 401));
  }

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError(req.t("error.changePasswordLoginAgain"), 401));
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  next();
});

module.exports = authMiddleware;
