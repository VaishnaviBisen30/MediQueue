const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const Doctor = require("../models/Doctor");
const generateSlots = require("../utils/slotGenerator");
const Appointment = require("../models/Appointment");

const router = express.Router();

router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware("patient"),
  (req, res) => {
    res.render("patient/dashboard");
  },
);

router.get(
  "/doctors",
  authMiddleware,
  roleMiddleware("patient"),
  async (req, res) => {
    try {
      const doctors = await Doctor.find().populate("user", "name email");
      res.render("patient/doctors", { doctors });
    } catch (error) {
      console.error(error);
      res.status(500).send("Error fetching doctors");
    }
  },
);

router.get(
  "/doctors/:id",
  authMiddleware,
  roleMiddleware("patient"),
  async (req, res) => {
    try {
      const doctor = await Doctor.findById(req.params.id).populate(
        "user",
        "name email",
      );
      if (!doctor) {
        return res.status(404).send("Doctor not found");
      }
      res.render("patient/doctorDetails", { doctor });
    } catch (error) {
      console.error(error);
      res.status(500).send("Error fetching doctor details");
    }
  },
);

router.get(
  "/doctors/:id/availability/:day",
  authMiddleware,
  roleMiddleware("patient"),
  async (req, res) => {
    try {
      const doctor = await Doctor.findById(req.params.id);

      if (!doctor) {
        return res.status(404).send("Doctor not found");
      }

      const availability = doctor.availability.find(
        (slot) => slot.day === req.params.day,
      );

      if (!availability) {
        return res.status(404).send("Availability not found");
      }

      const slots = generateSlots(
        availability.startTime,
        availability.endTime,
        availability.breakStart,
        availability.breakEnd,
      );

      res.render("patient/booking", {
        doctor,
        day: availability.day,
        slots,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send("Error fetching available slots");
    }
  },
);

router.post(
  "/doctors/:id/appointments",
  authMiddleware,
  roleMiddleware("patient"),
  async (req, res) => {
    try {
      const { date, day, startTime } = req.body;

      // 1. Validate the required form fields
      if (!date || !day || !startTime) {
        return res.status(400).send("Please provide all appointment details.");
      }

      // 2. Validate the date format and actual calendar date
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).send("Invalid appointment date.");
      }

      const selectedDate = new Date(`${date}T00:00:00.000Z`);

      if (
        Number.isNaN(selectedDate.getTime()) ||
        selectedDate.toISOString().slice(0, 10) !== date
      ) {
        return res.status(400).send("Invalid appointment date.");
      }

      // 3. Make sure the selected date is not in the past
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      if (date < today) {
        return res.status(400).send("You cannot book a past date.");
      }

      // 4. Verify that the doctor exists
      const doctor = await Doctor.findById(req.params.id);

      if (!doctor) {
        return res.status(404).send("Doctor not found.");
      }

      // 5. Check that the selected date matches the submitted weekday
      const weekdays = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      const actualDay = weekdays[selectedDate.getUTCDay()];

      if (actualDay !== day) {
        return res
          .status(400)
          .send("Selected date does not match the weekday.");
      }

      // 6. Verify the doctor's availability for that weekday
      const availability = doctor.availability.find(
        (slot) => slot.day === actualDay,
      );

      if (!availability) {
        return res.status(400).send("Doctor is not available on this day.");
      }

      // 7. Generate valid slots again on the server
      const slots = generateSlots(
        availability.startTime,
        availability.endTime,
        availability.breakStart,
        availability.breakEnd,
      );

      // Only accept a start time that belongs to a generated slot
      const selectedSlot = slots.find((slot) => slot.startTime === startTime);

      if (!selectedSlot) {
        return res.status(400).send("Invalid appointment time slot.");
      }

      // 8. Prevent booking a time that has already passed today
      if (date === today) {
        const [hours, minutes] = startTime.split(":").map(Number);
        const slotMinutes = hours * 60 + minutes;

        const now = new Date(
          new Date().toLocaleString("en-US", {
            timeZone: "Asia/Kolkata",
          }),
        );

        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        if (slotMinutes <= currentMinutes) {
          return res.status(400).send("This appointment time has passed.");
        }
      }

      // 9. Check whether this slot is already booked
      const existingAppointment = await Appointment.findOne({
        doctor: doctor._id,
        date,
        startTime: selectedSlot.startTime,
        status: "booked",
      });

      if (existingAppointment) {
        return res.status(409).send("This time slot is already booked.");
      }

      // 10. Save the appointment
      const appointment = new Appointment({
        patient: req.session.userId,
        doctor: doctor._id,
        date,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      });

      await appointment.save();

      // Temporary success response; we'll build a proper confirmation page later
      return res.send("Appointment booked successfully!");
    } catch (error) {
      console.error("Error booking appointment:", error);
      return res.status(500).send("Something went wrong while booking.");
    }
  },
);

router.get(
  "/appointments",
  authMiddleware,
  roleMiddleware("patient"),
  async (req, res) => {
    try {
      const appointments = await Appointment.find({
        patient: req.session.userId,
      })
        .populate({
          path: "doctor",
          populate: {
            path: "user",
            select: "name email",
          },
        })
        .sort({ date: 1, startTime: 1 });

      res.render("patient/appointments", { appointments });
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).send("Error fetching appointments.");
    }
  },
);

router.post(
  "/appointments/:id/cancel",
  authMiddleware,
  roleMiddleware("patient"),
  async (req, res) => {
    try {
      const appointment = await Appointment.findOne({
        _id: req.params.id,
        patient: req.session.userId,
        status: "booked",
      });

      if (!appointment) {
        return res
          .status(404)
          .send("Appointment not found or cannot be cancelled.");
      }

      appointment.status = "cancelled";
      appointment.cancelledBy = "patient";
      await appointment.save();

      return res.redirect("/patients/appointments");
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      return res
        .status(500)
        .send("Something went wrong while cancelling the appointment.");
    }
  },
);

module.exports = router;
