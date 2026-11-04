const roleMiddleware = (requiredRole) => {
  return (req, res, next) => {
    if (req.session.userRole !== requiredRole) {
      req.session.alert = "You do not have permission to access this resource.";
      res.redirect("/login");
    }

    next();
  };
};

module.exports = roleMiddleware;
