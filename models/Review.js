const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
{
patient: {
type: mongoose.Schema.Types.ObjectId,
ref: "User",
required: true,
},

doctor: {
type: mongoose.Schema.Types.ObjectId,
ref: "Doctor",
required: true,
},

appointment: {
type: mongoose.Schema.Types.ObjectId,
ref: "Appointment",
required: true,
unique: true,
},

rating: {
type: Number,
required: true,
min: 1,
max: 5,
},

comment: {
type: String,
trim: true,
maxlength: 500,
default: "",
},
},
{ timestamps: true },
);

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;