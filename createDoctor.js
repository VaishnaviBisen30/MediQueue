require("dotenv").config();

const Doctor = require("./models/Doctor");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const createDoctor = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const email = process.env.DOCTOR_EMAIL;
    const password = process.env.DOCTOR_PASSWORD;

    const existingDoctor = await Doctor.findOne({ email });

    if (existingDoctor) {
      console.log("Doctor already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newDoctor = new Doctor({
      name: process.env.DOCTOR_NAME,
      email,
      password: hashedPassword,
    });

    await newDoctor.save();
    console.log("Doctor created successfully");
  } catch (error) {
    console.error("Error creating doctor:", error);
  }
};
