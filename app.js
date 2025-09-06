const express = require("express");
const app = express();
const path = require("path");
const routes = require("./routes/routes");
const dotenv = require("dotenv");
dotenv.config();

// EJS & public
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use(routes);

// 404 fallback
app.use((req, res) => {
    res.status(404).render("404", { title: "404" });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
    console.log(`✅ Server pokrenut na portu ${PORT}`);
});
