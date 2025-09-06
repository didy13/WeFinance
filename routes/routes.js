const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const router = express.Router();
const connection = require("../controller/config");
const Korisnik = require("../models/Korisnik");
const registerValidation = require("../public/js/registerValidation");
const cron = require("node-cron");
const { checkDailyStreak, updateAllStreaks } = require("./streakManager");



Korisnik.setConnection(connection);

// Runs every day at midnight
cron.schedule("0 0 * * *", () => {
    const userId = 1; // or loop through all users
    checkDailyStreak(userId);
    updateAllStreaks();
    console.log("Daily streak check completed for user", userId);
  });

// SESSION setup
router.use(session({
    secret: process.env.SESSION_SECRET || "defaultsecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        secure: false,
        sameSite: "lax"
    }
}));

// Middleware za proveru da li je user ulogovan
const isAuthenticated = (req, res, next) => {
    if (true) {
        return next();
    }
    res.redirect("/login");
};

// --- ROUTES ---

// INDEX / Dashboard
router.get("/", isAuthenticated, (req, res) => {
    res.render("index", { title: "WeInvest - Dashboard", user: req.session.user });
});

router.get("/profile", isAuthenticated, (req, res) => {
    res.render("profile", { title: "WeInvest - Dashboard", user: req.session.user });
});

// LOGIN stranica
router.get("/login", (req, res) => {
    if (req.session.user) return res.redirect("/");
    res.render("login", { title: "WeInvest - Prijava", user: "", error: "" });
});

// LOGIN obrada
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.render("login", { error: "Username i password su obavezni", title: "WeInvest - Prijava", user: "" });
    }

    try {
        const user = await Korisnik.findByUsername(username);
        if (!user) return res.render("login", { error: "Nepostojeći korisnik", title: "WeInvest - Prijava", user: "" });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.render("login", { error: "Netačan password", title: "WeInvest - Prijava", user: "" });

        req.session.user = { username: user.username };
        req.session.save(() => res.redirect("/"));
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška na serveru");
    }
});

// LOGOUT
router.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).send("Greška pri odjavi");
        res.clearCookie("connect.sid");
        res.redirect("/login");
    });
});

// REGISTER stranica
router.get("/register", (req, res) => {
    if (req.session.user) return res.redirect("/");
    res.render("register", { title: "WeInvest - Registracija", user: "", error: "", errors: [] });
});

// REGISTER obrada
router.post("/register", registerValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render("register", {
            errors: errors.array(),
            title: "WeInvest - Registracija",
            user: "",
            error: errors.array()[0].msg
        });
    }

    const { username, password } = req.body;

    try {
        // Provera da li postoji korisnik
        const checkQuery = "SELECT * FROM users WHERE username = ?";
        const existingUsers = await new Promise((resolve, reject) => {
            connection.query(checkQuery, [username], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
        const existing = await Korisnik.findByUsername(username);
        if (existing) return res.render("register", { error: "Username već postoji", title: "WeInvest - Registracija", user: "", errors: [] });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new Korisnik(username, hashedPassword);
        await newUser.save();

        req.session.user = { username: newUser.username };
        req.session.save(() => res.redirect("/"));
    } catch (err) {
        console.error(err);
        res.status(500).render("register", { error: "Greška, pokušajte ponovo", title: "WeInvest - Registracija", user: "", errors: [] });
    }
});
router.put("/:id/goal", (req, res) => {
    const username = req.params.username;
    const { target } = req.body;
  
    const query = "UPDATE goals SET target = ? WHERE (SELECT id FROM users WHERE username = ?)";
    db.query(query, [target, username], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Savings goal updated successfully" });
    });
  });
  
  // Update balance
  router.put("/:id/balance", (req, res) => {
    const username = req.params.username;
    const { balance } = req.body;
  
    const query = "UPDATE goals SET balance = ? WHERE (SELECT id FROM users WHERE username = ?)";
    db.query(query, [balance, userId], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Balance updated successfully" });
    });
  });
  router.get("/groups", isAuthenticated, (req, res) => {
    // Primer: uzimamo grupe iz baze za trenutnog korisnika
    const userId = req.session.user.id; // pretpostavimo da si čuvao id
    const query = "SELECT * FROM table_group WHERE id IN (SELECT group_id FROM group_members WHERE user_id = (SELECT id FROM users WHERE username LIKE ?))";
    connection.query(query, [`%${userId}%`], (err, results) => {
        if (err) return res.status(500).send("Greška na serveru");
        res.render("groups", { title: "WeInvest - Grupe", user: req.session.user, groups: results });
    });
});

// --- Pregled jedne grupe ---
router.get("/groups/:id", isAuthenticated, (req, res) => {
    const groupId = req.params.id;

    // Uzimamo grupu i njene članove i ciljeve
    const query = `
        SELECT g.*, 
               (SELECT JSON_ARRAYAGG(username) FROM users u JOIN group_members gm ON u.id = gm.user_id WHERE gm.group_id = g.id) AS members,
               (SELECT JSON_ARRAYAGG(goal_name) FROM group_goals gg WHERE gg.group_id = g.id) AS goals
        FROM groups g
        WHERE g.id = ?
    `;

    connection.query(query, [groupId], (err, results) => {
        if (err) return res.status(500).send("Greška na serveru");
        if (results.length === 0) return res.status(404).send("Grupa nije pronađena");

        const group = results[0];
        // JSON_ARRAYAGG vraća string, pa parsiramo
        group.members = JSON.parse(group.members || '[]');
        group.goals = JSON.parse(group.goals || '[]');

        res.render("group_detail", { title: `WeInvest - ${group.name}`, user: req.session.user, group });
    });
});  
  // Get user info
  router.get("/:id", (req, res) => {
    const username = req.params.username;
    const query = `SELECT u.username AS username, 
                   u.balance AS balance, 
                   g.target AS target, 
                   g.current AS current,
                   u.streak AS streak,
                   FROM users AS u 
                   INNER JOIN goals AS g ON u.id = g.user_id 
                   WHERE username = ? `;
    db.query(query, [username], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results[0]);
    });
  });

module.exports = router;
