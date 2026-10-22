const roleMiddleware = (requiredRole) => {
    return (req, res, next) => {
        if (req.session.userRole !== requiredRole) {
            return res.status(403).send("You are not authorized to access this resource");
        }

        next();
    };
}

module.exports = roleMiddleware;