const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const authMiddleware = require("../middleware/authMiddleware");

// show register form
router.get("/register", (req, res) => {
  res.render("auth/register");
});

// Handle Registration
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.send("All fields are required");
    }

    if (password.length < 6) {
      return res.send("Password must be at least 6 characters");
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.send("Email already registered");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });
    await newUser.save();

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
      return res.send("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.send("Invalid email or password");
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
