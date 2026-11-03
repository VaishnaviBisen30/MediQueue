const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const Doctor = require("../models/Doctor");
const generateSlots = require("../utils/slotGenerator");
const Appointment = require("../models/Appointment");
const Notification = require("../models/Notification");

const router = express.Router();

router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware("patient"),
  async (req, res) => {
    try {
      // Get today's date in India in YYYY-MM-DD format
      const dateParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());

      const dateValues = Object.fromEntries(
        dateParts.map(({ type, value }) => [type, value]),
      );

      const today = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;

      const [
        upcomingAppointments,
        completedAppointments,
        cancelledAppointments,
        nextAppointment,
        unreadNotifications,
      ] = await Promise.all([
        Appointment.countDocuments({
          patient: req.session.userId,
          status: "booked",
          date: { $gte: today },
        }),

        Appointment.countDocuments({
          patient: req.session.userId,
          status: "completed",
        }),

        Appointment.countDocuments({
          patient: req.session.userId,
          status: "cancelled",
        }),

        Appointment.findOne({
          patient: req.session.userId,
          status: "booked",
          date: { $gte: today },
        })
          .sort({ date: 1, startTime: 1 })
          .populate({
            path: "doctor",
            populate: {
              path: "user",
              select: "name",
            },
          }),

        Notification.countDocuments({
          patient: req.session.userId,
          isRead: false,
        }),
      ]);

      res.render("patient/dashboard", {
        upcomingAppointments,
        completedAppointments,
        cancelledAppointments,
        nextAppointment,
        unreadNotifications,
      });
    } catch (error) {
      console.error("Error loading patient dashboard:", error);
      res.status(500).send("Unable to load dashboard");
    }
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

      await Notification.create([
        {
          patient: req.session.userId,
          message: `Your appointment has been booked successfully for ${date} at ${startTime}.`,
          type: "appointment",
        },
        {
          doctor: appointment.doctor,
          message: `You have a new appointment booking for ${date} at ${startTime}.`,
          type: "appointment",
        },
      ]);

      return res.redirect("/patients/appointments");
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

      await Notification.create([
        {
          patient: req.session.userId,
          message: `Your appointment on ${appointment.date} at ${appointment.startTime} has been cancelled successfully.`,
          type: "appointment",
        },
        {
          doctor: appointment.doctor,
          message: `The patient cancelled the appointment scheduled on ${appointment.date} at ${appointment.startTime}.`,
          type: "appointment",
        },
      ]);

      return res.redirect("/patients/appointments");
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      return res
        .status(500)
        .send("Something went wrong while cancelling the appointment.");
    }
  },
);

router.get(
  "/notifications",
  authMiddleware,
  roleMiddleware("patient"),
  async (req, res) => {
    try {
      const notifications = await Notification.find({
        patient: req.session.userId,
      }).sort({ createdAt: -1 });

      res.render("patient/notifications", { notifications });
    } catch (error) {
      console.error("Error fetching patient notifications:", error);
      res.status(500).send("Error fetching notifications.");
    }
  },
);

router.post(
  "/notifications/:id/read",
  authMiddleware,
  roleMiddleware("patient"),
  async (req, res) => {
    try {
      await Notification.findOneAndUpdate(
        {
          _id: req.params.id,
          patient: req.session.userId,
        },
        {
          isRead: true,
        },
      );

      res.redirect("/patients/notifications");
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).send("Unable to update notification.");
    }
  },
);

router.get(
  "/appointments/:id/reschedule",
  authMiddleware,
  roleMiddleware("patient"),
  async (req, res) => {
    try {
      const appointment = await Appointment.findOne({
        _id: req.params.id,
        patient: req.session.userId,
        status: "booked",
      }).populate({
        path: "doctor",
        populate: {
          path: "user",
          select: "name",
        },
      });

      if (!appointment) {
        return res
          .status(404)
          .send("Appointment not found or cannot be rescheduled.");
      }

      res.render("patient/reschedule", {
        appointment,
      });
    } catch (error) {
      console.error("Error loading reschedule page:", error);
      res.status(500).send("Unable to load rescheduling page.");
    }
  },
);

router.get(
  "/appointments/:id/available-slots",
  authMiddleware,
  roleMiddleware("patient"),
  async (req, res) => {
    try {
      const { date } = req.query;

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          message: "Invalid appointment date.",
        });
      }

      const selectedDate = new Date(`${date}T00:00:00.000Z`);

      if (
        Number.isNaN(selectedDate.getTime()) ||
        selectedDate.toISOString().slice(0, 10) !== date
      ) {
        return res.status(400).json({
          message: "Invalid appointment date.",
        });
      }

      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      if (date < today) {
        return res.status(400).json({
          message: "You cannot select a past date.",
        });
      }

      const appointment = await Appointment.findOne({
        _id: req.params.id,
        patient: req.session.userId,
        status: "booked",
      });

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found or cannot be rescheduled.",
        });
      }

      const doctor = await Doctor.findById(appointment.doctor);

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found.",
        });
      }

      const weekdays = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      const day = weekdays[selectedDate.getUTCDay()];

      const availability = doctor.availability.find((slot) => slot.day === day);

      if (!availability) {
        return res.json({
          slots: [],
          message: "Doctor is not available on this day.",
        });
      }

      const slots = generateSlots(
        availability.startTime,
        availability.endTime,
        availability.breakStart,
        availability.breakEnd,
      );

      const bookedAppointments = await Appointment.find({
        doctor: doctor._id,
        date,
        status: "booked",
        _id: { $ne: appointment._id },
      }).select("startTime");

      const bookedTimes = bookedAppointments.map((item) => item.startTime);

      let availableSlots = slots.filter(
        (slot) => !bookedTimes.includes(slot.startTime),
      );

      // Exclude time slots that have already passed today.
      if (date === today) {
        const now = new Date(
          new Date().toLocaleString("en-US", {
            timeZone: "Asia/Kolkata",
          }),
        );

        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        availableSlots = availableSlots.filter((slot) => {
          const [hours, minutes] = slot.startTime.split(":").map(Number);
          return hours * 60 + minutes > currentMinutes;
        });
      }

      return res.json({
        slots: availableSlots,
        day,
      });
    } catch (error) {
      console.error("Error fetching reschedule slots:", error);

      return res.status(500).json({
        message: "Unable to fetch available slots.",
      });
    }
  },
);

router.post(
  "/appointments/:id/reschedule",
  authMiddleware,
  roleMiddleware("patient"),
  async (req, res) => {
    try {
      const { date, day, startTime } = req.body;

      // 1. Validate required fields
      if (!date || !day || !startTime) {
        return res.status(400).send("Please provide all appointment details.");
      }

      // 2. Validate date format
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

      // 3. Prevent past dates
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      if (date < today) {
        return res.status(400).send("You cannot select a past date.");
      }

      // 4. Find the existing appointment
      const appointment = await Appointment.findOne({
        _id: req.params.id,
        patient: req.session.userId,
        status: "booked",
      });

      if (!appointment) {
        return res
          .status(404)
          .send("Appointment not found or cannot be rescheduled.");
      }

      // 5. Find the doctor
      const doctor = await Doctor.findById(appointment.doctor);

      if (!doctor) {
        return res.status(404).send("Doctor not found.");
      }

      // 6. Verify the submitted weekday
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

      // 7. Verify doctor's availability
      const availability = doctor.availability.find(
        (slot) => slot.day === actualDay,
      );

      if (!availability) {
        return res.status(400).send("Doctor is not available on this day.");
      }

      // 8. Generate valid slots again
      const slots = generateSlots(
        availability.startTime,
        availability.endTime,
        availability.breakStart,
        availability.breakEnd,
      );

      const selectedSlot = slots.find((slot) => slot.startTime === startTime);

      if (!selectedSlot) {
        return res.status(400).send("Invalid appointment time slot.");
      }

      // 9. Prevent selecting a time that has already passed today
      if (date === today) {
        const now = new Date(
          new Date().toLocaleString("en-US", {
            timeZone: "Asia/Kolkata",
          }),
        );

        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const [hours, minutes] = startTime.split(":").map(Number);
        const slotMinutes = hours * 60 + minutes;

        if (slotMinutes <= currentMinutes) {
          return res.status(400).send("This appointment time has passed.");
        }
      }

      // 10. Check whether another appointment has booked this slot
      const existingAppointment = await Appointment.findOne({
        doctor: doctor._id,
        date,
        startTime: selectedSlot.startTime,
        status: "booked",
        _id: { $ne: appointment._id },
      });

      if (existingAppointment) {
        return res.status(409).send("This time slot is already booked.");
      }

      // 11. Update the existing appointment
      const oldDate = appointment.date;
      const oldStartTime = appointment.startTime;

      appointment.date = date;
      appointment.startTime = selectedSlot.startTime;
      appointment.endTime = selectedSlot.endTime;

      await appointment.save();

      // 12. Notify patient and doctor
      await Notification.create([
        {
          patient: req.session.userId,
          message: `Your appointment has been rescheduled from ${oldDate} at ${oldStartTime} to ${date} at ${selectedSlot.startTime}.`,
          type: "appointment",
        },
        {
          doctor: appointment.doctor,
          message: `A patient has rescheduled an appointment from ${oldDate} at ${oldStartTime} to ${date} at ${selectedSlot.startTime}.`,
          type: "appointment",
        },
      ]);

      return res.redirect("/patients/appointments");
    } catch (error) {
      console.error("Error rescheduling appointment:", error);

      return res
        .status(500)
        .send("Something went wrong while rescheduling the appointment.");
    }
  },
);

module.exports = router;
