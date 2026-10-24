require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./models/User");

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    const existingAdmin = await User.findOne({ email });

    if (existingAdmin) {
      console.log("An account with this email already exists.");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = new User({
      name: process.env.ADMIN_NAME,
      email,
      password: hashedPassword,
      role: "admin",
    });

    await admin.save();

    console.log("Admin account created successfully.");
    console.log("Email:", email);
    console.log("Use the password configured in createAdmin.js to log in.");
  } catch (error) {
    console.error("Error creating admin:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin();
