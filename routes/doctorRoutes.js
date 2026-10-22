const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const Doctor = require("../models/Doctor");
const generateSlots = require("../utils/slotGenerator");
const Notification = require("../models/Notification");
const Appointment = require("../models/Appointment");

const router = express.Router();

router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware("doctor"),
  async (req, res) => {
    try {
      const doctor = await Doctor.findOne({
        user: req.session.userId,
      });

      res.render("doctor/dashboard", {
        availability: doctor ? doctor.availability : [],
      });
    } catch (error) {
      console.error(error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.get(
  "/profile",
  authMiddleware,
  roleMiddleware("doctor"),
  async (req, res) => {
    try {
      const doctor = await Doctor.findOne({
        user: req.session.userId,
      });

      res.render("doctor/profile", {
        doctor,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.post(
  "/profile",
  authMiddleware,
  roleMiddleware("doctor"),
  async (req, res) => {
    try {
      const {
        specialization,
        qualification,
        experience,
        consultationFee,
        about,
      } = req.body;

      let doctor = await Doctor.findOne({
        user: req.session.userId,
      });

      if (doctor) {
        // Update existing profile
        doctor.specialization = specialization;
        doctor.qualification = qualification;
        doctor.experience = experience;
        doctor.consultationFee = consultationFee;
        doctor.about = about;

        await doctor.save();
      } else {
        // Create new profile
        doctor = await Doctor.create({
          user: req.session.userId,
          specialization,
          qualification,
          experience,
          consultationFee,
          about,
        });
      }

      res.render("doctor/profile", {
        doctor,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.get(
  "/availability",
  authMiddleware,
  roleMiddleware("doctor"),
  async (req, res) => {
    try {
      const doctor = await Doctor.findOne({
        user: req.session.userId,
      });
      res.render("doctor/availability", { doctor });
    } catch (error) {
      console.error(error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.get(
  "/notifications",
  authMiddleware,
  roleMiddleware("doctor"),
  async (req, res) => {
    try {
      const doctor = await Doctor.findOne({
        user: req.session.userId,
      });

      if (!doctor) {
        return res.redirect("/doctors/profile");
      }

      const notifications = await Notification.find({
        doctor: doctor._id,
      }).sort({ createdAt: -1 });

      res.render("doctor/notifications", {
        notifications,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.get(
  "/availability/saved",
  authMiddleware,
  roleMiddleware("doctor"),
  async (req, res) => {
    try {
      const doctor = await Doctor.findOne({
        user: req.session.userId,
      });

      if (!doctor) {
        return res.status(404).send("Doctor profile not found");
      }

      res.render("doctor/savedAvailability", {
        availability: doctor.availability,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.get(
  "/availability/:day/slots",
  authMiddleware,
  roleMiddleware("doctor"),
  async (req, res) => {
    try {
      const doctor = await Doctor.findOne({
        user: req.session.userId,
      });

      if (!doctor) {
        return res.status(404).send("Doctor profile not found");
      }

      const availability = doctor.availability.find(
        (slot) => slot.day === req.params.day,
      );

      if (!availability) {
        return res.status(404).send("Availability not found");
      }

      // Generate slots for the current day
      const slots = generateSlots(
        availability.startTime,
        availability.endTime,
        availability.breakStart,
        availability.breakEnd,
      );

      // Find current day's position in availability array
      const currentIndex = doctor.availability.findIndex(
        (slot) => slot.day === req.params.day,
      );

      // Find previous and next available days
      const previousDay =
        currentIndex > 0 ? doctor.availability[currentIndex - 1] : null;

      const nextDay =
        currentIndex < doctor.availability.length - 1
          ? doctor.availability[currentIndex + 1]
          : null;

      res.render("doctor/slots", {
        slots,
        day: availability.day,
        previousDay,
        nextDay,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.post(
  "/availability",
  authMiddleware,
  roleMiddleware("doctor"),
  async (req, res) => {
    try {
      const { day, startTime, endTime, breakStart, breakEnd } = req.body;
      if (startTime >= endTime) {
        return res.send("End time must be after start time");
      }

      // If one break time is provided, both must be provided
      if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) {
        return res.send("Please provide both break start and break end time");
      }

      // Validate break timing
      if (breakStart && breakEnd) {
        // Break must have a valid duration
        if (breakStart >= breakEnd) {
          return res.send("Break end time must be after break start time");
        }

        // Break must be inside working hours
        if (breakStart < startTime || breakEnd > endTime) {
          return res.send("Break must be within working hours");
        }
      }
      const doctor = await Doctor.findOne({ user: req.session.userId });

      if (!doctor) {
        return res.status(404).send("Doctor profile not found");
      }

      const existingDay = doctor.availability.find((item) => item.day === day);

      if (existingDay) {
        return res.send("Availability for this day already exists");
      }

      doctor.availability.push({
        day,
        startTime,
        endTime,
        breakStart,
        breakEnd,
      });
      await doctor.save();
      res.redirect("/doctors/availability/saved");
    } catch (error) {
      console.error(error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.post(
  "/availability/:id/delete",
  authMiddleware,
  roleMiddleware("doctor"),
  async (req, res) => {
    try {
      const doctor = await Doctor.findOne({
        user: req.session.userId,
      });

      if (!doctor) {
        return res.status(404).send("Doctor profile not found");
      }

      // console.log(req.params.id);

      doctor.availability = doctor.availability.filter(
        (slot) => slot._id.toString() !== req.params.id,
      );

      await doctor.save();

      res.redirect("/doctors/availability/saved");
    } catch (error) {
      console.error(error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.get(
  "/notifications/test",
  authMiddleware,
  roleMiddleware("doctor"),
  async (req, res) => {
    try {
      const doctor = await Doctor.findOne({
        user: req.session.userId,
      });

      if (!doctor) {
        return res.redirect("/doctors/profile");
      }

      await Notification.create({
        doctor: doctor._id,
        message: "This is a test notification.",
        type: "general",
      });

      res.redirect("/doctors/notifications");
    } catch (error) {
      console.error(error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.post(
  "/notifications/:id/read",
  authMiddleware,
  roleMiddleware("doctor"),
  async (req, res) => {
    try {
      const doctor = await Doctor.findOne({
        user: req.session.userId,
      });

      if (!doctor) {
        return res.redirect("/doctors/profile");
      }

      await Notification.findOneAndUpdate(
        {
          _id: req.params.id,
          doctor: doctor._id,
        },
        {
          isRead: true,
        },
      );

      res.redirect("/doctors/notifications");
    } catch (error) {
      console.error(error);
      res.status(500).send("Something went wrong");
    }
  },
);

router.get(
  "/appointments",
  authMiddleware,
  roleMiddleware("doctor"),
  async (req, res) => {
    try {
      // Find the logged-in doctor's profile
      const doctor = await Doctor.findOne({
        user: req.session.userId,
      });

      if (!doctor) {
        return res.status(404).send("Doctor profile not found.");
      }

      // Find appointments booked with this doctor
      const appointments = await Appointment.find({
        doctor: doctor._id,
      })
        .populate("patient", "name email")
        .sort({ date: 1, startTime: 1 });

      res.render("doctor/appointments", { appointments });
    } catch (error) {
      console.error("Error fetching doctor appointments:", error);
      res.status(500).send("Error fetching appointments.");
    }
  },
);

router.post(
  "/appointments/:id/cancel",
  authMiddleware,
  roleMiddleware("doctor"),
  async (req, res) => {
    try {
      // Find the logged-in doctor's profile
      const doctor = await Doctor.findOne({
        user: req.session.userId,
      });

      if (!doctor) {
        return res.status(404).send("Doctor profile not found.");
      }

      // Find a booked appointment belonging to this doctor
      const appointment = await Appointment.findOne({
        _id: req.params.id,
        doctor: doctor._id,
        status: "booked",
      });

      if (!appointment) {
        return res
          .status(404)
          .send("Appointment not found or cannot be cancelled.");
      }

      // Cancel the appointment
      appointment.status = "cancelled";
      appointment.cancelledBy = "doctor";
      await appointment.save();

      // Return to the doctor's appointments page
      return res.redirect("/doctors/appointments");
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      return res
        .status(500)
        .send("Something went wrong while cancelling the appointment.");
    }
  },
);

module.exports = router;
