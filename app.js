const express = require("express");
const session = require("express-session");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const authRoutes = require("./routes/routes"); // ovo je tvoj routes fajl

const app = express();

// EJS i public
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Session setup OVDE (ne u routeru!)
app.use(session({
    secret: process.env.SESSION_SECRET || "defaultsecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        secure: false,
        sameSite: "lax"
    }
}));

// Routes
app.use("/", authRoutes); // mountujemo router na root

// 404 fallback
app.use((req, res) => {
    res.status(404).render("404", { title: "404" });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
    console.log(`✅ Server pokrenut na portu ${PORT}`);
});
