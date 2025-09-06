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
const Invite = require("../models/Invites");

var index = "index";
var group = "group";

Korisnik.setConnection(connection);
Group.setConnection(connection);
Invite.setConnection(connection);

cron.schedule("0 0 * * *", () => {
    console.log("🕛 Running daily streak check for all users...");
    updateAllStreaks();
});

router.use(session({
    secret: process.env.SESSION_SECRET || "defaultsecret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7, secure: false, sameSite: "lax" }
}));

const isAuthenticated = (req, res, next) => {
    if (req.session.user && req.session.user.id) return next();
    res.redirect("/login");
};

router.get("/", isAuthenticated, (req, res) => {
    res.render("index", {
        title: "WeInvest - Pametno upravljanje novcem za mlade",
        css: index,
        user: req.session.user
    });
});

router.get("/help", isAuthenticated, (req, res) => {
    res.render("help", {
        title: "WeInvest - Pomoć & Edukacija",
        css: index,
        user: req.session.user
    });
});

router.get("/profile", isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    try {
        const [user] = await new Promise((resolve, reject) => {
            connection.query("SELECT id, username, balance, streak FROM users WHERE id = ?", [userId], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        const goals = await new Promise((resolve, reject) => {
            connection.query("SELECT id, name, current, target FROM goals WHERE user_id = ?", [userId], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        const error = '';

        res.render("profile", { title: "WeInvest - Moj profil", user, goals, css: "profile", error });
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri učitavanju profila");
    }
});

router.get("/login", (req, res) => {
    if (req.session.user) return res.redirect("/");
    res.render("login", { title: "WeInvest - Prijava", css: index, user: "", error: "" });
});

router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.render("login", { title: "WeInvest - Prijava", css: index, user: "", error: "Korisničko ime i lozinka su obavezni" });

    try {
        const user = await Korisnik.findByUsername(username);
        if (!user) return res.render("login", { title: "WeInvest - Prijava", css: index, user: "", error: "Nepostojeće korisničko ime" });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.render("login", { title: "WeInvest - Prijava", css: index, user: "", error: "Netačna lozinka" });

        req.session.user = { id: user.id, username: user.username };
        req.session.save(() => res.redirect("/"));
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška na serveru");
    }
});

router.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).send("Greška pri odjavi");
        res.clearCookie("connect.sid");
        res.redirect("/login");
    });
});

router.get("/register", (req, res) => {
    if (req.session.user) return res.redirect("/");
    res.render("register", { title: "WeInvest - Registracija", user: "", css: index, error: "", errors: [] });
});

router.post("/register", registerValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.render("register", { title: "WeInvest - Registracija", user: "", error: errors.array()[0].msg, errors: errors.array() });

    const { username, password } = req.body;
    try {
        const existing = await Korisnik.findByUsername(username);
        if (existing) return res.render("register", { title: "WeInvest - Registracija", user: "", error: "Korisničko ime već postoji", errors: [] });

        const hashed = await bcrypt.hash(password, 10);
        const newUser = new Korisnik(username, hashed);
        const userId = await newUser.save();

        req.session.user = { id: userId, username };
        req.session.save(() => res.redirect("/"));
    } catch (err) {
        console.error(err);
        res.status(500).render("register", { title: "WeInvest - Registracija", user: "", error: "Greška, pokušajte ponovo", errors: [] });
    }
});

router.get("/groups", isAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    const groupsQuery = `
        SELECT g.*, 
               (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members_count,
               (SELECT COUNT(*) FROM group_goals gg WHERE gg.group_id = g.id) AS goals_count
        FROM table_group g
        WHERE g.id IN (SELECT group_id FROM group_members WHERE user_id = ?)
    `;

    const invitesQuery = `
        SELECT i.id AS invite_id, g.id AS group_id, g.name AS group_name, u.username AS inviter_name
        FROM group_invites i
        JOIN table_group g ON g.id = i.group_id
        JOIN users u ON u.id = i.inviter_id
        WHERE i.user_id = ?
    `;

    Promise.all([
        new Promise((resolve, reject) => connection.query(groupsQuery, [userId], (err, results) => err ? reject(err) : resolve(results))),
        new Promise((resolve, reject) => connection.query(invitesQuery, [userId], (err, results) => err ? reject(err) : resolve(results)))
    ])
        .then(([groups, invites]) => {
            const formattedGroups = groups.map(g => ({
                ...g,
                members: Array(g.members_count).fill("Član"),
                goals: Array(g.goals_count).fill("Cilj")
            }));
            res.render("groups", { title: "WeInvest - Grupe", user: req.session.user, css: group, groups: formattedGroups, invites });
        })
        .catch(err => {
            console.error(err);
            res.status(500).send("Greška pri učitavanju grupa ili invite-a");
        });
});

router.get("/newgroup", isAuthenticated, (req, res) => {
    res.render("new_group", { title: "WeInvest - Kreiranje nove grupe", css: index, user: req.session.user, error: "" });
});

router.post("/newgroup", isAuthenticated, async (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === "") return res.render("new_group", { title: "WeInvest - Kreiranje nove grupe", user: req.session.user, error: "Ime grupe je obavezno" });

    try {
        const group = new Group(name.trim());
        const groupId = await group.save();

        await new Promise((resolve, reject) => {
            connection.query("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", [groupId, req.session.user.id], (err) => err ? reject(err) : resolve());
        });

        res.redirect("/groups");
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri kreiranju grupe");
    }
});

router.get("/groups/:groupId", isAuthenticated, async (req, res) => {
    const groupId = req.params.groupId;
    await renderGroupWithError(res, groupId, {});
});

router.post("/groups/:groupId/add-member", isAuthenticated, async (req, res) => {
    const groupId = req.params.groupId;
    const { username } = req.body;
    const inviterId = req.session.user.id;

    try {
        const [user] = await new Promise((resolve, reject) => {
            connection.query("SELECT * FROM users WHERE username = ?", [username], (err, results) => err ? reject(err) : resolve(results));
        });

        if (!user) return renderGroupWithError(res, groupId, { errorAddMember: "Korisnik nije pronađen" });

        const [isMember] = await new Promise((resolve, reject) => {
            connection.query("SELECT * FROM group_members WHERE group_id = ? AND user_id = ?", [groupId, user.id], (err, results) => err ? reject(err) : resolve(results));
        });

        if (isMember) return renderGroupWithError(res, groupId, { errorAddMember: "Korisnik je već član grupe" });

        const [existingInvite] = await new Promise((resolve, reject) => {
            connection.query("SELECT * FROM group_invites WHERE group_id = ? AND user_id = ?", [groupId, user.id], (err, results) => err ? reject(err) : resolve(results));
        });

        if (existingInvite) return renderGroupWithError(res, groupId, { errorAddMember: "Pozivnica je već poslata ovom korisniku" });

        const invite = new Invite(groupId, user.id, inviterId);
        await invite.save();

        res.redirect(`/groups/${groupId}`);
    } catch (err) {
        console.error(err);
        renderGroupWithError(res, groupId, { errorAddMember: "Greška pri dodavanju člana" });
    }
});

async function renderGroupWithError(res, groupId, options = {}) {
    try {
        const [group] = await new Promise((resolve, reject) => 
            connection.query("SELECT * FROM table_group WHERE id = ?", [groupId], (err, results) => err ? reject(err) : resolve(results))
        );
        if (!group) return res.status(404).send("Grupa nije pronađena");

        const members = await new Promise((resolve, reject) =>
            connection.query(
                "SELECT u.id, u.username FROM users u JOIN group_members gm ON u.id = gm.user_id WHERE gm.group_id = ?",
                [groupId],
                (err, results) => err ? reject(err) : resolve(results)
            )
        );

        const goals = await new Promise((resolve, reject) =>
            connection.query("SELECT * FROM group_goals WHERE group_id = ?", [groupId],
                (err, results) => err ? reject(err) : resolve(results)
            )
        );

        const invites = await new Promise((resolve, reject) =>
            connection.query(
                `SELECT i.id AS invite_id, g.id AS group_id, g.name AS group_name, u.username AS inviter_name
                 FROM group_invites i
                 JOIN table_group g ON g.id = i.group_id
                 JOIN users u ON u.id = i.inviter_id
                 WHERE i.group_id = ?`,
                [groupId],
                (err, results) => err ? reject(err) : resolve(results)
            )
        );

        res.render("group_detail", {
    title: `WeInvest - ${group.name}`,
    user: res.req.session.user,
    group,
    members,
    goals,
    invites,
    errorAddMoney: options.errorAddMoney || "",
    errorAddMember: options.errorAddMember || "",
    errorAddGoal: options.errorAddGoal || "",
    successMessage: options.successMessage || "", // <--- ovo
    amountToAdd: options.amountToAdd || null,
    css: "group_detail"
});
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri učitavanju grupe");
    }
}

router.post("/groups/:groupId/add-goal", isAuthenticated, async (req, res) => {
    const { groupId } = req.params;
    const { name, target } = req.body;

    if (!name || name.trim() === "") return renderGroupWithError(res, groupId, { errorAddGoal: "Naziv cilja je obavezan" });
    if (!target || isNaN(target) || target <= 0) return renderGroupWithError(res, groupId, { errorAddGoal: "Target mora biti veći od 0" });

    try {
        await new Promise((resolve, reject) => {
            connection.query(
                "INSERT INTO group_goals (group_id, goal_name, current, target) VALUES (?, ?, 0, ?)",
                [groupId, name.trim(), target],
                (err, result) => err ? reject(err) : resolve(result)
            );
        });

        res.redirect(`/groups/${groupId}`);
    } catch (err) {
        console.error(err);
        renderGroupWithError(res, groupId, { errorAddGoal: "Greška pri dodavanju cilja" });
    }
});

router.post("/groups/:groupId/add-money/:goalId", isAuthenticated, async (req, res) => {
    const { groupId, goalId } = req.params;
    let { amount, confirm } = req.body;
    amount = parseFloat(amount);

    if (!amount || isNaN(amount) || amount <= 0) {
        return renderGroupWithError(res, groupId, {
            errorAddMoney: { goalId: parseInt(goalId), message: "Iznos mora biti veći od 0" }
        });
    }

    try {
        const [user] = await new Promise((resolve, reject) =>
            connection.query("SELECT balance FROM users WHERE id = ?", [req.session.user.id], (err, results) => err ? reject(err) : resolve(results))
        );

        if (!user) {
            return renderGroupWithError(res, groupId, {
                errorAddMoney: { goalId: parseInt(goalId), message: "Korisnik nije pronađen" }
            });
        }

        const [goal] = await new Promise((resolve, reject) =>
            connection.query("SELECT id, current, target, completed FROM group_goals WHERE id = ? AND group_id = ?", [goalId, groupId], (err, results) => err ? reject(err) : resolve(results))
        );

        if (!goal) {
            return renderGroupWithError(res, groupId, {
                errorAddMoney: { goalId: parseInt(goalId), message: "Cilj nije pronađen" }
            });
        }

        if (goal.completed) {
            return renderGroupWithError(res, groupId, {
                errorAddMoney: { goalId: parseInt(goalId), message: "Ovaj cilj je već završen" }
            });
        }

        // ❌ nema dovoljno
        if (amount > user.balance) {
            return renderGroupWithError(res, groupId, {
                errorAddMoney: { goalId: parseInt(goalId), message: `Nemate dovoljno novca. Trenutni balans: ${user.balance}` }
            });
        }

        // Koliko još treba do cilja
        const remaining = goal.target - goal.current;

        // Ako je korisnik uneo više nego što treba → skidamo samo "remaining"
        const finalAmount = Math.min(amount, remaining);

        // Ako je više od 70% balansa i nije potvrđeno
        const maxWarn = user.balance * 0.7;
        if (finalAmount > maxWarn && !confirm) {
            return renderGroupWithError(res, groupId, {
                errorAddMoney: { goalId: parseInt(goalId), message: `Pažnja! Ovo je više od 70% vašeg balansa (${user.balance}€). Potvrdite ako želite da nastavite.` },
                amountToAdd: { goalId: parseInt(goalId), amount: finalAmount }
            });
        }

        // ✅ izvrši transakciju
        await new Promise((resolve, reject) =>
            connection.query("UPDATE users SET balance = balance - ? WHERE id = ?", [finalAmount, req.session.user.id], err => err ? reject(err) : resolve())
        );

        await new Promise((resolve, reject) =>
            connection.query("UPDATE group_goals SET current = current + ? WHERE id = ? AND group_id = ?", [finalAmount, goalId, groupId], err => err ? reject(err) : resolve())
        );

        // Proveri da li je dostignut cilj
        if (goal.current + finalAmount >= goal.target) {
            await new Promise((resolve, reject) =>
                connection.query("UPDATE group_goals SET completed = 1 WHERE id = ?", [goalId], err => err ? reject(err) : resolve())
            );
            req.session.successMessage = "Uspešno dostignut cilj!";
        }

        res.redirect(`/groups/${groupId}`);
    } catch (err) {
        console.error(err);
        renderGroupWithError(res, groupId, {
            errorAddMoney: { goalId: parseInt(goalId), message: "Greška pri dodavanju novca na cilj" }
        });
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

router.post("/groups/:groupId/decline", isAuthenticated, (req, res) => {
    const { invite_id } = req.body;

    const deleteInviteQuery = `DELETE FROM group_invites WHERE id = ?`;

    connection.query(deleteInviteQuery, [invite_id], (err) => {
        if (err) return res.status(500).send("Greška pri brisanju pozivnice");
        res.redirect("/groups");
    });
});

router.get("/newgoals", isAuthenticated, (req, res) => {
    res.render("newgoal", { title: "WeInvest - Novi cilj štednje", user: req.session.user, css: index, error: "", errors: [] });
});

router.post("/creategoal", isAuthenticated, (req, res) => {
    console.log(req.body);
    const { name, target } = req.body;
    const userId = req.session.user.id;

    if (!name || !target) return res.render("newgoal", { title: "WeInvest - Kreiraj novi goal", user: req.session.user, css: index, error: "Popunite sva polja", errors: [] });

    connection.query("INSERT INTO goals (user_id, name, current, target) VALUES (?, ?, 0, ?)", [userId, name, target], (err, result) => {
        if (err) return res.status(500).send("Greška: " + err.message);
        res.redirect("/profile");
    });
});

router.post("/addgoalbalance", isAuthenticated, async (req, res) => {
    const { goalbalance, goalId } = req.body;
    const userId = req.session.user.id;
    const amount = parseFloat(goalbalance);

    if (isNaN(amount) || amount <= 0) return res.redirect("/profile");

    try {
        const [goalData] = await new Promise((resolve, reject) =>
            connection.query(
                `SELECT u.balance AS userBalance, g.current AS goalCurrent, g.target AS goalTarget
                 FROM users u
                 JOIN goals g ON u.id = g.user_id
                 WHERE u.id = ? AND g.id = ?`,
                [userId, goalId],
                (err, results) => err ? reject(err) : resolve(results)
            )
        );

        if (!goalData) return res.redirect("/profile");

        const { userBalance, goalCurrent, goalTarget } = goalData;

        if (amount > userBalance) {
            const [user] = await new Promise((resolve, reject) =>
                connection.query("SELECT id, username, balance FROM users WHERE id = ?", [userId], (err, results) => err ? reject(err) : resolve(results))
            );
            const goals = await new Promise((resolve, reject) =>
                connection.query("SELECT id, name, current, target FROM goals WHERE user_id = ?", [userId], (err, results) => err ? reject(err) : resolve(results))
            );
            return res.render("profile", { user, goals, error: "Not enough balance!", title: "Profile", css: "profile" });
        }

        const newGoalCurrent = Math.min(goalCurrent + amount, goalTarget);
        const newUserBalance = userBalance - amount;

        await new Promise((resolve, reject) =>
            connection.query(
                `UPDATE users u
                 JOIN goals g ON g.user_id = u.id
                 SET g.current = ?, u.balance = ?
                 WHERE u.id = ? AND g.id = ?`,
                [newGoalCurrent, newUserBalance, userId, goalId],
                (err) => err ? reject(err) : resolve()
            )
        );

        res.redirect("/profile");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error adding money to goal");
    }
});
router.post("/changebalance", isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    let { balans } = req.body;
    balans = parseFloat(balans);

    if (isNaN(balans) || balans <= 0) {
        // vrati profil sa greškom
        const [user] = await new Promise((resolve, reject) =>
            connection.query("SELECT id, username, balance, streak FROM users WHERE id = ?", [userId], (err, results) => err ? reject(err) : resolve(results))
        );
        const goals = await new Promise((resolve, reject) =>
            connection.query("SELECT id, name, current, target FROM goals WHERE user_id = ?", [userId], (err, results) => err ? reject(err) : resolve(results))
        );
        return res.render("profile", { user, goals, error: "Iznos mora biti veći od 0", title: "WeInvest - Moj profil", css: "profile" });
    }

    try {
        await new Promise((resolve, reject) => {
            connection.query("UPDATE users SET balance = balance + ? WHERE id = ?", [balans, userId], (err) => err ? reject(err) : resolve());
        });
        res.redirect("/profile");
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri dodavanju novca na balans");
    }
});
module.exports = router;
