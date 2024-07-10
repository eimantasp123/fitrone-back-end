const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.sendStatus(403); // Forbidden if user does not have the required role
    }
    next(); // Proceed if user has the required role
  };
};

module.exports = authorizeRoles;
