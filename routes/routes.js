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

// --- Set DB connections ---
Korisnik.setConnection(connection);
Group.setConnection(connection);
Invite.setConnection(connection);

// --- Cron task for daily streak update ---
cron.schedule("0 0 * * *", () => {
    console.log("🕛 Running daily streak check for all users...");
    updateAllStreaks();
});

// --- SESSION setup ---
router.use(session({
    secret: process.env.SESSION_SECRET || "defaultsecret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000*60*60*24*7, secure: false, sameSite: "lax" }
}));

// --- Middleware for authentication ---
const isAuthenticated = (req, res, next) => {
    if (req.session.user && req.session.user.id) return next();
    res.redirect("/login");
};

// --- DASHBOARD ---
router.get("/", isAuthenticated, (req, res) => {
    res.render("index", { 
        title: "WeInvest - Pametno upravljanje novcem za mlade", 
        css: "index",
        user: req.session.user 
    });
});

router.get("/help", isAuthenticated, (req, res) => {
    res.render("help", { 
        title: "WeInvest - Pametno upravljanje novcem za mlade", 
        css: "index",
        user: req.session.user 
    });
});


// --- PROFILE ---
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

        const errorBalance = '';

        res.render("profile", { title: "WeInvest - Profile", user, goals,css: "index", errorBalance });
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri učitavanju profila");
    }
});

// --- LOGIN ---
router.get("/login", (req, res) => {
    if (req.session.user) return res.redirect("/");
    res.render("login", { title: "WeInvest - Prijava",css: "index", user: "", error: "" });
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
    res.render("register", { title:"WeInvest - Registracija", user:"",css: "index", error:"", errors: [] });
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

// --- GROUPS LIST ---
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
        res.render("groups", { title: "WeInvest - Grupe", user: req.session.user,css: "group", groups: formattedGroups, invites });
    })
    .catch(err => {
        console.error(err);
        res.status(500).send("Greška pri učitavanju grupa ili invite-a");
    });
});

// --- NEW GROUP ---
router.get("/newgroup", isAuthenticated, (req, res) => {
    res.render("new_group", { title: "WeInvest - Kreiraj novu grupu",css: "index", user: req.session.user, error: "" });
});

router.post("/newgroup", isAuthenticated, async (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === "") return res.render("new_group", { title: "WeInvest - Kreiraj novu grupu", user: req.session.user, error: "Ime grupe je obavezno" });

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

// --- GROUP DETAIL ---
router.get("/groups/:groupId", isAuthenticated, async (req, res) => {
    const groupId = req.params.groupId;
    await renderGroupWithError(res, groupId, "");
});

// --- ADD MEMBER / INVITE ---
router.post("/groups/:groupId/add-member", isAuthenticated, async (req, res) => {
    const groupId = req.params.groupId;
    const { username } = req.body;
    const inviterId = req.session.user.id;

    try {
        const [user] = await new Promise((resolve, reject) => {
            connection.query("SELECT * FROM users WHERE username = ?", [username], (err, results) => err ? reject(err) : resolve(results));
        });

        if (!user) return renderGroupWithError(res, groupId, "Korisnik nije pronađen");

        const [isMember] = await new Promise((resolve, reject) => {
            connection.query("SELECT * FROM group_members WHERE group_id = ? AND user_id = ?", [groupId, user.id], (err, results) => err ? reject(err) : resolve(results));
        });

        if (isMember) return renderGroupWithError(res, groupId, "Korisnik je već član grupe");

        const [existingInvite] = await new Promise((resolve, reject) => {
            connection.query("SELECT * FROM group_invites WHERE group_id = ? AND user_id = ?", [groupId, user.id], (err, results) => err ? reject(err) : resolve(results));
        });

        if (existingInvite) return renderGroupWithError(res, groupId, "Pozivnica je već poslata ovom korisniku");

        const invite = new Invite(groupId, user.id, inviterId);
        await invite.save();

        res.redirect(`/groups/${groupId}`);
    } catch (err) {
        console.error(err);
        renderGroupWithError(res, groupId, "Greška pri dodavanju člana");
    }
});

// --- Helper function to render group detail with error ---
async function renderGroupWithError(res, groupId, errorMsg) {
    try {
        const [group] = await new Promise((resolve, reject) => connection.query("SELECT * FROM table_group WHERE id = ?", [groupId], (err, results) => err ? reject(err) : resolve(results)));
        if (!group) return res.status(404).send("Grupa nije pronađena");

        const members = await new Promise((resolve, reject) => connection.query(
            "SELECT u.id, u.username FROM users u JOIN group_members gm ON u.id = gm.user_id WHERE gm.group_id = ?",
            [groupId],
            (err, results) => err ? reject(err) : resolve(results)
        ));

        const goals = await new Promise((resolve, reject) => connection.query(
            "SELECT * FROM group_goals WHERE group_id = ?", [groupId],
            (err, results) => err ? reject(err) : resolve(results)
        ));

        const invites = await new Promise((resolve, reject) => connection.query(
            `SELECT i.id AS invite_id, g.id AS group_id, g.name AS group_name, u.username AS inviter_name
             FROM group_invites i
             JOIN table_group g ON g.id = i.group_id
             JOIN users u ON u.id = i.inviter_id
             WHERE i.group_id = ?`, [groupId],
            (err, results) => err ? reject(err) : resolve(results)
        ));
        res.render("group_detail", { 
            title: `WeInvest - ${group.name}`,
            user: res.req.session.user,
            group,
            members,
            goals,
            invites,
            css: "index",
            error: errorMsg || ""
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri učitavanju grupe");
    }
}
// --- ADD GOAL TO GROUP ---
router.post("/groups/:groupId/add-goal", isAuthenticated, async (req, res) => {
    const { groupId } = req.params;
    const { name, target } = req.body;

    if (!name || name.trim() === "") return renderGroupWithError(res, groupId, "Naziv cilja je obavezan");
    if (!target || isNaN(target) || target <= 0) return renderGroupWithError(res, groupId, "Target mora biti veći od 0");

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
        renderGroupWithError(res, groupId, "Greška pri dodavanju cilja");
    }
});

// --- ADD MONEY TO GROUP GOAL ---
router.post("/groups/:groupId/add-money/:goalId", isAuthenticated, async (req, res) => {
    const { groupId, goalId } = req.params;
    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) return renderGroupWithError(res, groupId, "Iznos mora biti veći od 0");

    try {
        await new Promise((resolve, reject) => {
            connection.query(
                "UPDATE group_goals SET current = current + ? WHERE id = ? AND group_id = ?",
                [amount, goalId, groupId],
                (err, result) => err ? reject(err) : resolve(result)
            );
        });

        res.redirect(`/groups/${groupId}`);
    } catch (err) {
        console.error(err);
        renderGroupWithError(res, groupId, "Greška pri dodavanju novca na cilj");
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

// Render the "New Goal" form
  router.get("/newgoals", isAuthenticated, (req, res) => {
     res.render("newgoal", { title:"WeInvest - Kreiraj novi goal", user: req.session.user, error:"", errors: [] });
});
  
  // Handle form submission to create a new goal
  router.post("/creategoal", isAuthenticated, (req, res) => {
    console.log(req.body);
    const { name, target } = req.body;

    if (!name || !target) {
      return res.render("newgoal", {
        title: "WeInvest - Kreiraj novi goal",
        user: req.session.user,
        error: "Morate popuniti oba polja!",
        errors: []
      });
    }
  
    const query = "INSERT INTO goals (name, target, user_id) VALUES (?, ?, ?)";
    connection.query(query, [name, target, req.session.user.id], (err, result) => {
      if (err) return res.status(500).send("Error creating goal: " + err.message);
  
      res.redirect("/profile");
    });
  });


  router.post("/changebalance", isAuthenticated, async (req, res) => {
    let { balans } = req.body;
    const goals = await new Promise((resolve, reject) => {
        connection.query("SELECT id, name, current, target FROM goals WHERE user_id = ?", [req.session.user.id], (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
    const [user] = await new Promise((resolve, reject) => {
        connection.query("SELECT id, username, balance, streak FROM users WHERE id = ?", [req.session.user.id], (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
    // Check if input is empty
    if(isNaN(balans) || !balans){
        return res.render("profile", {title: 'WeInvest - Profile', goals, errorBalance: 'Morate popuniti balans!', user});
    }
  
    const balance = parseFloat(balans);
  
    const query = "UPDATE users SET balance = ? WHERE id = ?";
    connection.query(query, [balance, req.session.user.id], (err, result) => {
      if (err) return res.status(500).send("Error updating balance: " + err.message);
  
      res.redirect("/profile");
    });
  });
  
  
  

// --- EXPORT ROUTER ---
module.exports = router;
