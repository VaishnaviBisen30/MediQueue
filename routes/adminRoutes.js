const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const Doctor = require("../models/Doctor");

const router = express.Router();

router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware("admin"),
  (req, res) => {
    res.render("admin/dashboard");
  },
);

router.get(
  "/doctors",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res) => {
    try {
      const doctors = await Doctor.find()
        .populate("user", "name email")
        .sort({ createdAt: -1 });

      res.render("admin/doctors", {
        doctors,
      });
    } catch (error) {
      console.error("Error fetching doctors:", error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.post(
  "/doctors/:id/approve",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res) => {
    try {
      const doctor = await Doctor.findByIdAndUpdate(
        req.params.id,
        { status: "approved" },
        { new: true, runValidators: true },
      );

      if (!doctor) {
        return res.status(404).send("Doctor not found");
      }

      res.redirect("/admin/doctors");
    } catch (error) {
      console.error("Error approving doctor:", error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.post("/doctors/:id/reject", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true, runValidators: true }
    );

    if (!doctor) {
      return res.status(404).send("Doctor not found");
    }

    res.redirect("/admin/doctors");
  } catch (error) {
    console.error("Error rejecting doctor:", error);
    res.status(500).send("Something went wrong");
  }
});

module.exports = router;
