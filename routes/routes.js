const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const router = express.Router();
const connection = require("../controller/config"); 
const Korisnik = require("../models/Korisnik");
const registerValidation = require("../public/js/registerValidation");
const Group = require("../models/Group");

// Set connection
Korisnik.setConnection(connection);

// SESSION setup
router.use(session({
    secret: process.env.SESSION_SECRET || "defaultsecret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000*60*60*24*7, secure: false, sameSite: "lax" }
}));

// Middleware za autentikaciju
const isAuthenticated = (req, res, next) => {
    if (req.session.user && req.session.user.id) return next();
    res.redirect("/login");
};

// --- DASHBOARD ---
router.get("/", isAuthenticated, (req, res) => {
    res.render("index", { title: "WeInvest - Dashboard", user: req.session.user });
});

// --- PROFILE ---
router.get("/profile", isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;

    try {
        // Dohvati korisnika
        const [user] = await new Promise((resolve, reject) => {
            connection.query("SELECT id, username, balance, streak FROM users WHERE id = ?", [userId], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        // Dohvati sve ciljeve korisnika
        const goals = await new Promise((resolve, reject) => {
            connection.query("SELECT id, name, current, target FROM goals WHERE user_id = ?", [userId], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        res.render("profile", { title: "WeInvest - Profile", user, goals });
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri učitavanju profila");
    }
});

// --- LOGIN ---
router.get("/login", (req, res) => {
    if (req.session.user) return res.redirect("/");
    res.render("login", { title: "WeInvest - Prijava", user: "", error: "" });
});

router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.render("login", { title:"WeInvest - Prijava", user:"", error:"Username i password su obavezni" });

    try {
        const user = await Korisnik.findByUsername(username);
        if (!user) return res.render("login", { title:"WeInvest - Prijava", user:"", error:"Nepostojeći korisnik" });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.render("login", { title:"WeInvest - Prijava", user:"", error:"Netačan password" });

        req.session.user = { id: user.id, username: user.username };
        req.session.save(() => res.redirect("/"));
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška na serveru");
    }
});

// --- LOGOUT ---
router.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).send("Greška pri odjavi");
        res.clearCookie("connect.sid");
        res.redirect("/login");
    });
});

// --- REGISTER ---
router.get("/register", (req, res) => {
    if (req.session.user) return res.redirect("/");
    res.render("register", { title:"WeInvest - Registracija", user:"", error:"", errors: [] });
});

router.post("/register", registerValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.render("register", { title:"WeInvest - Registracija", user:"", error:errors.array()[0].msg, errors: errors.array() });

    const { username, password } = req.body;
    try {
        const existing = await Korisnik.findByUsername(username);
        if (existing) return res.render("register", { title:"WeInvest - Registracija", user:"", error:"Username već postoji", errors: [] });

        const hashed = await bcrypt.hash(password, 10);
        const newUser = new Korisnik(username, hashed);
        const userId = await newUser.save();

        req.session.user = { id: userId, username };
        req.session.save(() => res.redirect("/"));
    } catch (err) {
        console.error(err);
        res.status(500).render("register", { title:"WeInvest - Registracija", user:"", error:"Greška, pokušajte ponovo", errors: [] });
    }
});

// --- GROUPS ---
router.get("/groups", isAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    const query = `
        SELECT * FROM table_group 
        WHERE id IN (
            SELECT group_id FROM group_members WHERE user_id = ?
        )
    `;
    connection.query(query, [userId], (err, results) => {
        if (err) return res.status(500).send("Greška pri učitavanju grupa");
        res.render("groups", { title:"WeInvest - Grupe", user:req.session.user, groups: results });
    });
});

router.post("/groups/new", isAuthenticated, async (req, res) => {
    const { name } = req.body;
    try {
        const group = new Group(name);
        const groupId = await group.save();
        await connection.query("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", [groupId, req.session.user.id]);
        res.redirect("/groups");
    } catch(err) {
        console.error(err);
        res.status(500).send("Greška pri kreiranju grupe");
    }
});

module.exports = router;
