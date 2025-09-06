const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const router = express.Router();
const connection = require("../controller/config"); 
const Korisnik = require("../models/Korisnik");
const registerValidation = require("../public/js/registerValidation");
const cron = require("node-cron");
const { updateAllStreaks } = require("../public/js/streakManager");


const Group = require("../models/Group");

// Set connection
Korisnik.setConnection(connection);

const Invite = require("../models/Invites");

// Set connection
Korisnik.setConnection(connection);
Group.setConnection(connection);
Invite.setConnection(connection);
// Runs every day at midnight


// Run every day at midnight
cron.schedule("0 0 * * *", () => {
  console.log("🕛 Running daily streak check for all users...");
  updateAllStreaks();
});


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
    res.render("index", { title: "WeInvest - Pametno upravljanje novcem za mlade", user: req.session.user });
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

    // Dohvati grupe korisnika
    const groupsQuery = `
        SELECT g.*, 
               (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members_count,
               (SELECT COUNT(*) FROM group_goals gg WHERE gg.group_id = g.id) AS goals_count
        FROM table_group g
        WHERE g.id IN (
            SELECT group_id FROM group_members WHERE user_id = ?
        )
    `;

    // Dohvati invite-ove korisniku
    const invitesQuery = `
        SELECT i.id AS invite_id, g.id AS group_id, g.name AS group_name, u.username AS inviter_name
        FROM group_invites i
        JOIN table_group g ON g.id = i.group_id
        JOIN users u ON u.id = i.inviter_id
        WHERE i.user_id = ?
    `;

    // Koristimo Promise.all da dobijemo obe stvari paralelno
    const queryGroups = new Promise((resolve, reject) => {
        connection.query(groupsQuery, [userId], (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });

    const queryInvites = new Promise((resolve, reject) => {
        connection.query(invitesQuery, [userId], (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });

    Promise.all([queryGroups, queryInvites])
        .then(([groups, invites]) => {
            // Za svaki group dodajemo members i goals ako želiš
            const formattedGroups = groups.map(g => ({
                ...g,
                members: Array(g.members_count).fill("Član"), // ili ako imaš stvarne korisnike, možeš promeniti
                goals: Array(g.goals_count).fill("Cilj")     // samo da bi frontend radio
            }));

            res.render("groups", {
                title: "WeInvest - Grupe",
                user: req.session.user,
                groups: formattedGroups,
                invites
            });
        })
        .catch(err => {
            console.error(err);
            res.status(500).send("Greška pri učitavanju grupa ili invite-a");
        });
});


// --- NEW GROUP PAGE ---
router.get("/groups/new", isAuthenticated, (req, res) => {
    res.render("new_group", {
        title: "WeInvest - Kreiraj novu grupu",
        user: req.session.user,
        error: ""
    });
});

router.post("/groups/new", isAuthenticated, async (req, res) => {
    const { name } = req.body;

    if (!name || name.trim() === "") {
        return res.render("new_group", {
            title: "WeInvest - Kreiraj novu grupu",
            user: req.session.user,
            error: "Ime grupe je obavezno"
        });
    }

    try {
        const group = new Group(name.trim());
        const groupId = await group.save();

        // Dodaj trenutnog korisnika kao člana grupe
        connection.query(
            "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
            [groupId, req.session.user.id],
            (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send("Greška pri dodavanju člana grupe");
                }
                res.redirect("/groups");
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri kreiranju grupe");
    }
});

router.get("/groups/:groupId", isAuthenticated, async (req, res) => {
    const groupId = req.params.groupId;

    try {
        // Dohvati osnovne info o grupi
        const [group] = await new Promise((resolve, reject) => {
            connection.query("SELECT * FROM table_group WHERE id = ?", [groupId], (err, results) => {
                if(err) return reject(err);
                resolve(results);
            });
        });

        if(!group) return res.status(404).send("Grupa nije pronađena");

        // Dohvati članove grupe
        const members = await new Promise((resolve, reject) => {
            connection.query(`
                SELECT u.id, u.username 
                FROM users u 
                JOIN group_members gm ON u.id = gm.user_id 
                WHERE gm.group_id = ?
            `, [groupId], (err, results) => {
                if(err) return reject(err);
                resolve(results);
            });
        });

        // Dohvati ciljeve grupe
        const goals = await new Promise((resolve, reject) => {
            connection.query(`
                SELECT * FROM group_goals WHERE group_id = ?
            `, [groupId], (err, results) => {
                if(err) return reject(err);
                resolve(results);
            });
        });

        res.render("group_detail", { 
            title: `WeInvest - ${group.name}`,
            user: req.session.user,
            group,
            members,
            goals
        });

    } catch(err) {
        console.error(err);
        res.status(500).send("Greška pri učitavanju detalja grupe");
    }
});

// --- ADD NEW MEMBER (INVITE) ---
router.post("/groups/:groupId/add-member", isAuthenticated, async (req, res) => {
    const groupId = req.params.groupId;
    const { username } = req.body;
    const inviterId = req.session.user.id;

    try {
        const [user] = await new Promise((resolve, reject) => {
            connection.query("SELECT * FROM users WHERE username = ?", [username], (err, results) => {
                if(err) return reject(err);
                resolve(results);
            });
        });

        if(!user) return res.status(404).send("Korisnik nije pronađen");

        // Dodaj invite
        const invite = new Invite(groupId, user.id, inviterId);
        await invite.save();

        res.redirect(`/groups/${groupId}`);
    } catch(err) {
        console.error(err);
        res.status(500).send("Greška pri dodavanju člana");
    }
});

// --- ADD/UPDATE GOAL ---
router.post("/groups/:groupId/add-goal", isAuthenticated, async (req, res) => {
    const groupId = req.params.groupId;
    const { name, target } = req.body;

    try {
        await new Promise((resolve, reject) => {
            connection.query("INSERT INTO group_goals (group_id, name, target, current) VALUES (?, ?, ?, 0)", 
                [groupId, name, target], (err, result) => {
                    if(err) return reject(err);
                    resolve(result);
                });
        });

        res.redirect(`/groups/${groupId}`);
    } catch(err) {
        console.error(err);
        res.status(500).send("Greška pri dodavanju cilja");
    }
});

// --- ADD MONEY TO GOAL ---
router.post("/groups/:groupId/add-money/:goalId", isAuthenticated, async (req, res) => {
    const { groupId, goalId } = req.params;
    const { amount } = req.body;

    try {
        await new Promise((resolve, reject) => {
            connection.query("UPDATE group_goals SET current = current + ? WHERE id = ? AND group_id = ?", 
                [amount, goalId, groupId], (err, result) => {
                    if(err) return reject(err);
                    resolve(result);
                });
        });

        res.redirect(`/groups/${groupId}`);
    } catch(err) {
        console.error(err);
        res.status(500).send("Greška pri dodavanju novca");
    }
});

router.post("/groups/:groupId/accept", isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const { invite_id } = req.body;
    const { groupId } = req.params;

    const addMemberQuery = `INSERT INTO group_members (group_id, user_id) VALUES (?, ?)`;
    const deleteInviteQuery = `DELETE FROM group_invites WHERE id = ?`;

    connection.query(addMemberQuery, [groupId, userId], (err) => {
        if (err) return res.status(500).send("Greška pri dodavanju člana");

        connection.query(deleteInviteQuery, [invite_id], (err2) => {
            if (err2) return res.status(500).send("Greška pri brisanju pozivnice");
            res.redirect("/groups");
        });
    });
});

// Odbijanje pozivnice
router.post("/groups/:groupId/decline", isAuthenticated, (req, res) => {
    const { invite_id } = req.body;

    const deleteInviteQuery = `DELETE FROM group_invites WHERE id = ?`;

    connection.query(deleteInviteQuery, [invite_id], (err) => {
        if (err) return res.status(500).send("Greška pri brisanju pozivnice");
        res.redirect("/groups");
    });
});

module.exports = router;
