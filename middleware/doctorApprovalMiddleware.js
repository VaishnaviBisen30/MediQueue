const Doctor = require("../models/Doctor");

const doctorApprovalMiddleware = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({
      user: req.session.userId,
    });

    // If the doctor has no profile, redirect to create one
    if (!doctor) {
      return res.redirect("/doctors/profile");
    }

    // If the profile is not approved, deny access
    if (doctor.status === "pending") {
      return res
        .status(403)
        .send("Your doctor profile is awaiting admin approval.");
    }

    if (doctor.status === "rejected") {
      return res
        .status(403)
        .send("Your doctor profile has been rejected. Please contact support.");
    }

    // Allow the request to continue
    next();
  } catch (error) {
    console.error("Doctor approval check failed:", error);
    return res.status(500).send("Something went wrong.");
  }
};

module.exports = doctorApprovalMiddleware;
