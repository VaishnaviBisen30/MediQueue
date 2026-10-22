const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
    "/dashboard",
    authMiddleware,
    roleMiddleware("admin"),
    (req, res) => {
        res.send("Welcome Admin");
    }
);

module.exports = router;