const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    specialization: {
      type: String,
      required: true,
    },

    qualification: {
      type: String,
      required: true,
    },

    experience: {
      type: Number,
      required: true,
    },

    about: {
      type: String,
    },

    consultationFee: {
      type: Number,
      required: true,
    },
    availability: [
      {
        day: {
          type: String,
          required: true,
        },

        startTime: {
          type: String,
          required: true,
        },

        endTime: {
          type: String,
          required: true,
        },

        breakStart: String,
        breakEnd: String,
      },
    ],
  },

  {
    timestamps: true,
  },
);

const Doctor = mongoose.model("Doctor", doctorSchema);
module.exports = Doctor;
