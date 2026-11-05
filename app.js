const express = require("express");
const path = require("path");
require("dotenv").config();

const connectDB = require("./config/db");
const app = express();
connectDB(); // Connect to MongoDB
const session = require("express-session");
const MongoStore = require("connect-mongo").default;

const patientRoutes = require("./routes/patientRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "defaultsecret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI || "mongodb://localhost:27017/mediqueue",
    }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  }),
);

app.use((req, res, next) => {
  res.locals.alert = req.session.alert;
  delete req.session.alert;
  next();
});

// Static files
app.use(express.static(path.join(__dirname, "public")));

// EJS setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use((req, res, next) => {
  res.locals.userId = req.session.userId;
  res.locals.userRole = req.session.userRole;
  next();
});

// Home route
app.get("/", (req, res) => {
  res.render("home");
});

app.use("/", authRoutes);
app.use("/patients", patientRoutes);
app.use("/doctors", doctorRoutes);
app.use("/admin", adminRoutes);

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
