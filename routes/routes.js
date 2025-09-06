const express = require("express");
const session = require("express-session");
require('dotenv').config();
const router = express.Router();
const connection = require("../controller/config");
const bcrypt = require("bcrypt");
const Korisnik = require("../models/Korisnik");
const registerValidation = require("../public/js/registerValidation");
const { validationResult } = require('express-validator');
const axios = require('axios');
const { OpenWeatherAPI } = require("openweather-api-node")
const translate = require('@iamtraction/google-translate');
const NodeCache = require('node-cache');
router.use(express.json());

Korisnik.setConnection(connection);

router.use(session({
    secret: process.env.SESSION_SECRET || "defaultsecret", // Proveri da li postoji vrednost u .env
    resave: false, // Nemoj ponovo snimati sesiju ako se ne menja
    saveUninitialized: false, // Nemoj čuvati prazne sesije
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // Kolačić traje 7 dana
        secure: false, // Postavi na true ako koristiš HTTPS
        sameSite: "lax" // Poboljšava sigurnost sesije
    }
}));
    
const isAuthenticated = (req, res, next) =>
{
    console.log(req.session);
    if (req.session.user) {
        next(); 
    } else {
        res.redirect("/login"); 
    }
}

const cache = new NodeCache({ stdTTL: 300, checkperiod: 320 }); // Cache expires in 5 min

router.get("/login", (req, res) => {
    if (req.session.user) {
        return res.redirect("/");
    }
    res.render("login",{title: "GeoQuest Prijava", user: "", error: ""});
});

router.post("/login", (req, res) => {
    const { nickname, lozinka } = req.body;
    const query = "SELECT * FROM Korisnik WHERE nickname = ?";

    connection.query(query, [nickname], async (err, results) => {
        if (err) {
            return res.status(500).send("Internal Server Error");
        }

        if (results.length > 0) {
            const validPassword = await bcrypt.compare(lozinka, results[0].lozinka);
            if (validPassword) {
                req.session.user = { username: results[0].nickname, admin: results[0].admin};
                req.session.save((saveErr) => { // Eksplicitno sačuvaj sesiju
                    if (saveErr) {
                        console.error("Error saving session:", saveErr);
                        return res.status(500).send("Error saving session");
                    }
                    return res.redirect("/");
                });
                return; // Završava funkciju nakon redirect-a
            }
        }

        res.render("login", { error: "Netačna lozinka ili korisničko ime", title: "GeoQuest Prijava", user: "" });
    });
});

router.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
            return res.status(500).send("Unable to log out");
        }
        res.clearCookie("connect.sid", { path: "/" }); // Postavi tačan path ako je drugačiji
        res.redirect("/login");
    });
});

router.get("/register", (req, res) => {
    let username = "";
    if(req.session.user)
    {
        username = req.session.user;
    }
    res.render("register", { error: "",title: "GeoQuest Registracija", user: username, errors: [] }); // Pretpostavljamo da postoji odgovarajuća view datoteka
});

// POST: Obrada podataka za registraciju
router.post('/register', registerValidation, async (req, res) => {
    // Validate the form inputs
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        // Validation errors detected
        return res.status(400).render('register', {
            errors: errors.array(), // Pass validation errors
            formData: req.body, // Retain form input data
            title: 'GeoQuest Register', // Page title
            user: req.session.user || '', // Pass session user (if available)
            error: null // No global error message
        });
    }

    const { ime, prezime, nickname, email, lozinka, date } = req.body;

    try {
        // Check if the user already exists (email or nickname)
        const checkQuery = "SELECT * FROM Korisnik WHERE email = ? OR nickname = ?";
        const existingUsers = await new Promise((resolve, reject) => {
            connection.query(checkQuery, [email, nickname], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
        
        if (existingUsers.length > 0) {
            // User with email or nickname already exists
            return res.status(400).render('register', {
                errors: [], // No validation errors
                formData: req.body, // Retain form input data
                title: 'GeoQuest Registracija', 
                user: req.session.user || '',
                error: 'Email ili korisničko ime već postoje!' // Global error message
            });
        }
        

        // Hash the password
        const hashedPassword = await bcrypt.hash(lozinka, 10);

        // Create a new user instance
        const newUser = new Korisnik(ime, prezime, nickname, email, hashedPassword, date);

        // Save the user to the database
        await newUser.save();

        // Store the user in the session
        req.session.user = { username: newUser.nickname, admin: false };
        req.session.save((err) => {
            if (err) {
                console.error('Error saving session:', err);
                return res.status(500).send('Error saving session');
            }
            // Redirect to the homepage after successful registration
            res.redirect('/');
        });
    } catch (error) {
        console.error('Error during registration:', error);

        // Render the registration page with an error message
        res.status(500).render('register', {
            errors: [], // No validation errors
            formData: req.body, // Retain form input data
            title: 'GeoQuest Registracija',
            user: req.session.user || '',
            error: 'Došlo je do greške. Pokušajte ponovo.' // General error message
        });
    }
});

module.exports = router;