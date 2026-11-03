const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const Doctor = require("../models/Doctor");
const Patient = require("../models/User");
const Appointment = require("../models/Appointment");

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

router.post(
  "/doctors/:id/reject",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res) => {
    try {
      const doctor = await Doctor.findByIdAndUpdate(
        req.params.id,
        { status: "rejected" },
        { new: true, runValidators: true },
      );

      if (!doctor) {
        return res.status(404).send("Doctor not found");
      }

      res.redirect("/admin/doctors");
    } catch (error) {
      console.error("Error rejecting doctor:", error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.get(
  "/patients",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res) => {
    try {
      const patients = await Patient.find({ role: "patient" })
        .populate("name email")
        .sort({ createdAt: -1 });

      res.render("admin/patients", {
        patients,
      });
    } catch (error) {
      console.error("Error fetching patients:", error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.get(
  "/appointments",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res) => {
    try {
      const appointments = await Appointment.find()
        .populate("patient", "name email")
        .populate({
          path: "doctor",
          populate: { path: "user", select: "name email" },
        })
        .sort({ createdAt: -1 });

      res.render("admin/appointments", {
        appointments,
      });
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.get(
  "/overview",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res) => {
    try {
      const totalDoctors = await Doctor.countDocuments();
      const totalPatients = await Patient.countDocuments({ role: "patient" });
      const totalAppointments = await Appointment.countDocuments();
      const pendingApprovals = await Doctor.countDocuments({
        status: "pending",
      });
      const bookedAppointments = await Appointment.countDocuments({
        status: "booked",
      });
      const completedAppointments = await Appointment.countDocuments({
        status: "completed",
      });
      const cancelledAppointments = await Appointment.countDocuments({
        status: "cancelled",
      });
      const approvedDoctors = await Doctor.countDocuments({
        status: "approved",
      });
      const rejectedDoctors = await Doctor.countDocuments({
        status: "rejected",
      });

      res.render("admin/overview", {
        totalDoctors,
        totalPatients,
        totalAppointments,
        pendingApprovals,
        bookedAppointments,
        completedAppointments,
        cancelledAppointments,
        approvedDoctors,
        rejectedDoctors,
      });
    } catch (error) {
      console.error("Error fetching overview data:", error);
      res.status(500).send("Something went wrong");
    }
  },
);

module.exports = router;
