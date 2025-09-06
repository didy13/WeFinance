const express = require("express");
const router = express.Router();
const connection = require("../controller/config");
const bcrypt = require("bcrypt");
const Korisnik = require("../models/Korisnik");
const registerValidation = require("../public/script/registerValidation");
const { validationResult } = require("express-validator");

Korisnik.setConnection(connection);

// Middleware za proveru da li je user ulogovan
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect("/login");
};

// --- ROUTES ---

// INDEX (dashboard)
router.get("/", isAuthenticated, (req, res) => {
    res.render("index", {
        title: "WeInvest - Dashboard",
        user: req.session.user
    });
});

// LOGIN stranica
router.get("/login", (req, res) => {
    if (req.session.user) return res.redirect("/");
    res.render("login", { title: "WeInvest - Prijava", user: "", error: "" });
});

// LOGIN obrada
router.post("/login", (req, res) => {
    const { nickname, lozinka } = req.body;
    const query = "SELECT * FROM users WHERE username = ?";

    connection.query(query, [nickname], async (err, results) => {
        if (err) return res.status(500).send("Greška na serveru");

        if (results.length > 0) {
            const validPassword = await bcrypt.compare(lozinka, results[0].lozinka);
            if (validPassword) {
                req.session.user = { username: results[0].nickname, admin: results[0].admin };
                return req.session.save(() => res.redirect("/"));
            }
        }
        res.render("login", { error: "Netačna lozinka ili korisničko ime", title: "WeInvest - Prijava", user: "" });
    });
});

// LOGOUT
router.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
            return res.status(500).send("Greška pri odjavi");
        }
        res.clearCookie("connect.sid");
        res.redirect("/login");
    });
});

// REGISTER stranica
router.get("/register", (req, res) => {
    if (req.session.user) return res.redirect("/");
    res.render("register", { error: "", title: "WeInvest - Registracija", user: "", errors: [] });
});

// REGISTER obrada
router.post("/register", registerValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).render("register", {
            errors: errors.array(),
            formData: req.body,
            title: "WeInvest - Registracija",
            user: "",
            error: null
        });
    }

    const { username, password } = req.body;

    try {
        // Provera da li postoji korisnik
        const checkQuery = "SELECT * FROM users WHERE username = ?";
        const existingUsers = await new Promise((resolve, reject) => {
            connection.query(checkQuery, [email, username], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        if (existingUsers.length > 0) {
            return res.status(400).render("register", {
                errors: [],
                formData: req.body,
                title: "WeInvest - Registracija",
                user: "",
                error: "Korisničko ime već postoji!"
            });
        }

        // Hash lozinke
        const hashedPassword = await bcrypt.hash(password, 10);

        // Novi korisnik
        const newUser = new Korisnik(username, hashedPassword);
        await newUser.save();

        // Odmah logujemo usera posle registracije
        req.session.user = { username: newUser.nickname, admin: false };
        req.session.save(() => res.redirect("/"));
    } catch (error) {
        console.error("Greška pri registraciji:", error);
        res.status(500).render("register", {
            errors: [],
            formData: req.body,
            title: "WeInvest - Registracija",
            user: "",
            error: "Došlo je do greške. Pokušajte ponovo."
        });
    }
});

module.exports = router;
