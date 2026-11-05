const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const authMiddleware = require("../middleware/authMiddleware");
const Doctor = require("../models/Doctor");

// show register form
router.get("/register", (req, res) => {
  res.render("auth/register");
});

// Handle Registration

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      specialization,
      qualification,
      experience,
      consultationFee,
      about,
    } = req.body;

    // Basic validation
    if (!name || !email || !password || !role) {
      req.session.alert = "All fields are required";
      return res.redirect("/register");
    }

    // Only patient and doctor registration allowed
    if (!["patient", "doctor"].includes(role)) {
      req.session.alert = "Invalid registration role";
      return res.redirect("/register");
    }

    if (password.length < 6) {
      req.session.alert = "Password must be at least 6 characters";
      return res.redirect("/register");
    }

    // Check doctor-specific fields
    if (role === "doctor") {
      if (
        !specialization ||
        !qualification ||
        experience === "" ||
        experience === undefined ||
        consultationFee === "" ||
        consultationFee === undefined
      ) {
        req.session.alert = "All doctor details are required";
        return res.redirect("/register");
      }

      if (
        !Number.isFinite(Number(experience)) ||
        Number(experience) < 0 ||
        !Number.isFinite(Number(consultationFee)) ||
        Number(consultationFee) < 0
      ) {
        req.session.alert = "Enter valid experience and consultation fee";
        return res.redirect("/register");
      }
    }

    // Check existing user
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      req.session.alert = "Email already registered";
      return res.redirect("/register");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
    });

    await newUser.save();

    // Create doctor profile if role is doctor
    if (role === "doctor") {
      try {
        const newDoctor = new Doctor({
          user: newUser._id,
          specialization,
          qualification,
          experience: Number(experience),
          consultationFee: Number(consultationFee),
          about,
          status: "pending",
        });

        await newDoctor.save();
      } catch (error) {
        // Remove user if doctor profile creation fails
        await User.findByIdAndDelete(newUser._id);
        throw error;
      }
    }

    if (role === "doctor") {
      req.session.alert =
        "Registration submitted successfully. Your profile is pending admin approval.";
    } else {
      req.session.alert = "Registration successful. Please log in.";
    }

    res.redirect("/login");
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong");
  }
});

router.get("/login", (req, res) => {
  res.render("auth/login");
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      req.session.alert = "Invalid email or password";
      return res.redirect("/login");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      req.session.alert = "Invalid email or password";
      return res.redirect("/login");
    }

    req.session.userId = user._id; // Store user ID in session
    req.session.userRole = user.role; // Store user role in session

    if (user.role === "patient") {
      return res.redirect("/patients/dashboard");
    }

    if (user.role === "doctor") {
      return res.redirect("/doctors/dashboard");
    }

    if (user.role === "admin") {
      return res.redirect("/admin/dashboard");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong");
  }
});

// router.get("/dashboard", authMiddleware, (req, res) => {
//   // The authMiddleware will handle the authentication check
//   // If the user is not authenticated, they will be redirected to the login page

//   res.send(`You are logged in. User ID: ${req.session.userId}`);
// });

router.get("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.send("Unable to logout");
    }

    res.redirect("/login");
  });
});

module.exports = router;
