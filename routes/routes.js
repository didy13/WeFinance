const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const router = express.Router();
const connection = require("../controller/config");
const Korisnik = require("../models/Korisnik");
const registerValidation = require("../public/js/registerValidation");
const cron = require("node-cron");
const Group = require("../models/Group");
const Invite = require("../models/Invites");
const { showThrottleMessage } = require("ethers");
const loginValidation = require("../public/js/loginValidation");

var index = "index";
var group = "group";

Korisnik.setConnection(connection);
Group.setConnection(connection);
Invite.setConnection(connection);

// ====================== CRON ======================
cron.schedule("35 2 * * *", () => {
  console.log("🕛 Running daily streak and reset check...");

  const query = "SELECT id, streak, daily_goal, daily_saved FROM users";
  connection.query(query, (err, users) => {
    if (err) return console.error(err);

    users.forEach(user => {
      let newStreak = user.streak;

      if (user.daily_goal !== null && user.daily_saved >= user.daily_goal) {
        newStreak += 1;
        const query = `
          UPDATE user_achievements 
          SET current = ?
          WHERE achievement_id in (7,8,9,10) and user_id = ?
        `;
        connection.query(query, [newStreak, user.id], (err) => {
          if (err) return console.error(err);
        });
      } else {
        newStreak = 0;
      }

      const updateQuery = `
        UPDATE users
        SET streak = ?, daily_saved = 0
        WHERE id = ?
      `;
      connection.query(updateQuery, [newStreak, user.id], err2 => {
        if (err2) console.error(err2);
      });
    });
  });
});

// ====================== SESSION ======================
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

// Middleware: osveži user-a u sesiji na svakoj ruti
const refreshUser = (req, res, next) => {
  if (!req.session.user || !req.session.user.id) return next();
  connection.query(
    "SELECT id, username, balance, streak, daily_goal, daily_saved, tutorial FROM users WHERE id = ?",
    [req.session.user.id],
    (err, results) => {
      if (err) {
        console.error("refreshUser err:", err);
        return next();
      }
      if (results && results.length) {
        const u = results[0];
        req.session.user = {
          ...req.session.user,
          id: u.id,
          username: u.username,
          balance: u.balance,
          streak: u.streak,
          daily_goal: u.daily_goal,
          daily_saved: u.daily_saved,
          tutorial: u.tutorial,
          showTutorial: !u.tutorial // true ako tutorijal NIJE završen
        };
      }
      next();
    }
  );
};

router.use(refreshUser);

// ====================== HELPER: centralizovano učitavanje i render profila ======================
async function loadAndRenderProfile(req, res, errorMessage = "") {
  const userId = req.session.user.id;
  try {
    const [user] = await new Promise((resolve, reject) => {
      connection.query(
        "SELECT id, username, balance, streak, daily_goal, daily_saved, tutorial FROM users WHERE id = ?",
        [userId],
        (err, results) => err ? reject(err) : resolve(results)
      );
    });

    // Pokupi sve ciljeve korisnika
    const allGoals = await new Promise((resolve, reject) => {
      connection.query(
        "SELECT id, name, current, target, completed FROM goals WHERE user_id = ?",
        [userId],
        (err, results) => err ? reject(err) : resolve(results)
      );
    });

    // Odmah ih podeli
    const completedGoals = allGoals.filter(g => g.completed === 1);
    const activeGoals = allGoals.filter(g => !g.completed || g.completed === 0);

    const expenses = await new Promise((resolve, reject) => {
      connection.query(
        "SELECT * FROM expenses WHERE user_id = ?",
        [userId],
        (err, results) => err ? reject(err) : resolve(results)
      );
    });

    // Markiraj završene ciljeve (ako current == target)
    await new Promise((resolve, reject) => {
      connection.query(
        "UPDATE goals SET completed = 1 WHERE current = target AND user_id = ?",
        [userId],
        (err) => err ? reject(err) : resolve()
      );
    });

    const showTutorial = !user.tutorial;

    // update sesije
    req.session.user = {
      ...req.session.user,
      username: user.username,
      balance: user.balance,
      streak: user.streak,
      daily_goal: user.daily_goal,
      daily_saved: user.daily_saved,
      tutorial: user.tutorial,
      showTutorial
    };

    res.render("profile", {
      title: "WeFinance - Moj profil",
      user,
      goals: activeGoals,       // <--- šalješ samo aktivne
      completedGoals,           // <--- i posebno završene
      expenses,
      css: "profile",
      error: errorMessage,
      showTutorial
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Greška pri učitavanju profila");
  }
}

// ====================== ROUTES ======================
router.get("/", isAuthenticated, (req, res) => {
  res.render("index", {
    title: "WeFinance - Pametno upravljanje novcem za mlade",
    css: index,
    user: req.session.user
  });
});

router.get("/achievement", isAuthenticated, async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      const query = `
        UPDATE user_achievements ua
        JOIN users u ON u.id = ua.user_id
        SET ua.current = u.balance
        WHERE ua.achievement_id in (2, 5) AND ua.user_id = ?
      `;
      connection.query(query, [req.session.user.id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const achievements = await new Promise((resolve, reject) => {
      connection.query(
        "SELECT a.id, a.name, a.description, a.target, a.types, ua.current FROM achievements a INNER JOIN user_achievements ua ON a.id = ua.achievement_id WHERE ua.user_id = ?",
        [req.session.user.id],
        (err, results) => err ? reject(err) : resolve(results)
      );
    });

    res.render("achievement", {
      title: "WeFinance - Pametno upravljanje novcem za mlade",
      css: "achievement",
      user: req.session.user,
      achievements: achievements,
      error: ""
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Greška pri učitavanju dostignuca");
  }
});

router.get("/help", isAuthenticated, async (req, res) => {
  res.render("help", {
    title: "WeFinance - Pomoć & Edukacija",
    css: "help",
    user: req.session.user
  });
});

router.get("/profile", isAuthenticated, async (req, res) => {
  return loadAndRenderProfile(req, res);
});

router.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("login", { title: "WeFinance - Prijava", css: index, user: "", error: "", errors: {} });
});

router.post("/finish-tutorial", isAuthenticated, (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) {
    return res.status(401).send("Niste prijavljeni.");
  }

  const query = "UPDATE users SET tutorial = TRUE WHERE id = ?";
  connection.query(query, [userId], (err, result) => {
    if (err) {
      console.error("Greška prilikom update tutorijala:", err);
      return res.status(500).send("Greška servera.");
    }

    if (result.affectedRows > 0) {
      // osveži sesiju da odmah sakrije tutorijal
      req.session.user.tutorial = true;
      req.session.user.showTutorial = false;
      return res.json({ success: true, message: "Tutorijal završen!" });
    } else {
      return res.status(400).json({ success: false, message: "Korisnik nije pronađen." });
    }
  });
});

// Dodavanje rashoda
router.post("/expenses", isAuthenticated, (req, res) => {
  const { name, amount } = req.body;
  const userId = req.session.user?.id;
  const resultsQuery = `
    SELECT u.balance
    FROM users u
    WHERE u.id = ?
  `;

  if (!userId) {
    return res.redirect("/login");
  }
    connection.query(resultsQuery, [userId], (err, results) => {
        if (err) return loadAndRenderProfile(req, res, "Greška baze.");
        if (results.length === 0) return res.redirect("/profile");
    
        const userBalance = parseFloat(results[0].balance);
    
        // korisnik nema dovoljno novca
        if (amount > userBalance) {
          return loadAndRenderProfile(req, res, `Nemate dovoljno novca. Balans: ${userBalance}`);
        }
        
    
        // ako je uneo više nego što je potrebno → skrati na preostali iznos
        
    
        const newBalance = userBalance - amount;
        const balanceQuery = "UPDATE users SET balance = ? WHERE id = ?";
        connection.query(balanceQuery, [newBalance, userId], (err) => {
          if (err) {
            console.error(err);
            // nakon greške opet učitaj profil sa porukom
            return loadAndRenderProfile(req, res, "Greška pri dodavanju rashoda.");
          }
          });
        // Ako je cilj dostignut nakon ove transakcije
        

  const query = "INSERT INTO expenses (user_id, name, amount) VALUES (?, ?, ?)";
  connection.query(query, [userId, name, amount], (err) => {
    if (err) {
      console.error(err);
      // nakon greške opet učitaj profil sa porukom
      return loadAndRenderProfile(req, res, "Greška pri dodavanju rashoda.");
    }
    // uspeh → vrati na profil (koji će opet učitati expenses)
    res.redirect("/profile");
  });
});
});

router.post("/login", loginValidation, async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const mappedErrors = errors.mapped(); // { username: {msg: ...}, password: {msg: ...} }
    return res.render("login", {
      title: "WeFinance - Prijava",
      css: index,
      user: req.body,
      errors: mappedErrors
    });
  }

  const { username, password } = req.body;

  try {
    const user = await Korisnik.findByUsername(username);
    if (!user) {
      return res.render("login", {
        title: "WeFinance - Prijava",
        css: index,
        user: req.body,
        errors: { username: { msg: "Nepostojeće korisničko ime" } }
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.render("login", {
        title: "WeFinance - Prijava",
        css: index,
        user: req.body,
        errors: { password: { msg: "Netačna lozinka" } }
      });
    }

    // ako je sve ok
    req.session.user = {
      id: user.id,
      username: user.username,
      streak: user.streak
    };
    req.session.save(() => res.redirect("/"));
  } catch (err) {
    console.error(err);
    res.status(500).render("login", {
      title: "WeFinance - Prijava",
      css: index,
      user: req.body,
      errors: { general: { msg: "Greška na serveru, pokušajte ponovo" } }
    });
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
  res.render("register", { title: "WeFinance - Registracija", user: "", css: index, error: "", errors: [] });
});

router.post("/register", registerValidation, async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const mappedErrors = errors.mapped(); // { username: { msg: "..." }, password: {...}, confirmPassword: {...} }
    return res.render("register", {
      title: "WeFinance - Registracija",
      user: req.body, // da inputi ostanu popunjeni
      css: index,
      error: "",
      errors: mappedErrors
    });
  }

  const { username, password } = req.body;

  try {
    const existing = await Korisnik.findByUsername(username);
    if (existing) {
      return res.render("register", {
        title: "WeFinance - Registracija",
        user: req.body,
        css: index,
        error: "",
        errors: { username: { msg: "Korisničko ime već postoji" } }
      });
    }

    const hashed = await bcrypt.hash(password, 10);
    const newUser = new Korisnik(username, hashed);
    const userId = await newUser.save();

    // inicijalno postignuće
    await new Promise((resolve, reject) => {
      connection.query(
        "UPDATE user_achievements SET current = 1 WHERE achievement_id = 1;",
        (err) => (err ? reject(err) : resolve())
      );
    });

    req.session.user = { id: userId, username };
    req.session.save(() => res.redirect("/"));
  } catch (err) {
    console.error(err);
    res.status(500).render("register", {
      title: "WeFinance - Registracija",
      user: req.body,
      css: index,
      error: "",
      errors: { general: { msg: "Greška, pokušajte ponovo" } }
    });
  }
});

router.get("/groups", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const userId = req.session.user.id;

  try {
    // ---- Sve grupe gde je user član ----
    const groupsQuery = `
      SELECT g.*,
             (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members_count,
             (SELECT COUNT(*) FROM group_goals gg WHERE gg.group_id = g.id) AS goals_count
      FROM table_group g
      WHERE g.id IN (
          SELECT group_id 
          FROM group_members 
          WHERE user_id = ?
      );
    `;

    let groups = await new Promise((resolve, reject) =>
      connection.query(groupsQuery, [userId], (err, results) =>
        err ? reject(err) : resolve(results)
      )
    );

    // Dodaj "fake arrays" za members i goals
    groups = groups.map(group => {
      group.members = Array(group.members_count).fill({});
      group.goals = Array(group.goals_count).fill({});
      return group;
    });

    // ---- Pozivnice koje je user dobio ----
    const invitesQuery = `
      SELECT gi.*, g.name AS group_name, u.username AS inviter_name
      FROM group_invites gi
      JOIN table_group g ON gi.group_id = g.id
      JOIN users u ON gi.inviter_id = u.id
      WHERE gi.user_id = ?;
    `;

    const invites = await new Promise((resolve, reject) =>
      connection.query(invitesQuery, [userId], (err, results) =>
        err ? reject(err) : resolve(results)
      )
    );

    res.render("groups", {
      user: req.session.user,
      groups,
      invites,
      title: "WeFinance - Grupe",
      css: group
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Greška na serveru");
  }
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
        `SELECT i.id AS invite_id, g.id AS group_id, g.name AS group_name,
                inviter.username AS inviter_name,
                invitee.username AS invitee_name
         FROM group_invites i
         JOIN table_group g ON g.id = i.group_id
         JOIN users inviter ON inviter.id = i.inviter_id
         JOIN users invitee ON invitee.id = i.user_id
         WHERE i.group_id = ?`,
        [groupId],
        (err, results) => err ? reject(err) : resolve(results)
      )
    );

    res.render("group_detail", {
      title: `WeFinance - ${group.name}`,
      user: res.req.session.user,
      group,
      members,
      goals,
      invites,
      errorAddMoney: options.errorAddMoney || "",
      errorAddMember: options.errorAddMember || "",
      errorAddGoal: options.errorAddGoal || "",
      successMessage: options.successMessage || "",
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
      connection.query(
        "SELECT id, current, target, completed FROM group_goals WHERE id = ? AND group_id = ?",
        [goalId, groupId],
        (err, results) => err ? reject(err) : resolve(results)
      )
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

    const userBalance = Number(user.balance);
    const goalCurrent = Number(goal.current);
    const goalTarget = Number(goal.target);

    if (amount > userBalance) {
      return renderGroupWithError(res, groupId, {
        errorAddMoney: { goalId: parseInt(goalId), message: `Nemate dovoljno novca. Trenutni balans: ${userBalance}` }
      });
    }

    const remaining = goalTarget - goalCurrent;
    const finalAmount = Math.min(amount, remaining);

    const maxWarn = userBalance * 0.7;
    if (finalAmount > maxWarn && !confirm) {
      return renderGroupWithError(res, groupId, {
        errorAddMoney: { goalId: parseInt(goalId), message: `Pažnja! Ovo je više od 70% vašeg balansa (${userBalance}€). Potvrdite ako želite da nastavite.` },
        amountToAdd: { goalId: parseInt(goalId), amount: finalAmount }
      });
    }

    await new Promise((resolve, reject) =>
      connection.query("UPDATE users SET balance = balance - ? WHERE id = ?", [finalAmount, req.session.user.id], err => err ? reject(err) : resolve())
    );

    await new Promise((resolve, reject) =>
      connection.query("UPDATE group_goals SET current = current + ? WHERE id = ? AND group_id = ?", [finalAmount, goalId, groupId], err => err ? reject(err) : resolve())
    );

    const newCurrent = goalCurrent + finalAmount;
    if (newCurrent >= goalTarget) {
      await new Promise((resolve, reject) =>
        connection.query("UPDATE group_goals SET completed = 1 WHERE id = ?", [goalId], err => err ? reject(err) : resolve())
      );
      await new Promise((resolve, reject) =>
        connection.query("UPDATE user_achievements SET current = 1 WHERE achievement_id = 6 and user_id = ?", [req.session.user.id], err => err ? reject(err) : resolve())
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
  const achievementQuery = `UPDATE user_achievements SET current = 1 WHERE achievement_id = 3 and user_id = ?`;
  const deleteInviteQuery = `DELETE FROM group_invites WHERE id = ?`;

  connection.query(addMemberQuery, [groupId, userId], (err) => {
    if (err) return res.status(500).send("Greška pri dodavanju člana");
    connection.query(achievementQuery, [userId], (err) => {
      if (err) return res.status(500).send("Greška pri dodavanju dostignuca");
      connection.query(deleteInviteQuery, [invite_id], (err2) => {
        if (err2) return res.status(500).send("Greška pri brisanju pozivnice");
        res.redirect("/groups");
      });
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
  res.render("newgoal", { title: "WeFinance - Novi cilj štednje", user: req.session.user, css: index, error: "", errors: [] });
});

router.post("/creategoal", isAuthenticated, (req, res) => {
  const { name, target } = req.body;
  const userId = req.session.user.id;

  if (!name || !target) return res.render("newgoal", { title: "WeFinance - Kreiraj novi goal", user: req.session.user, css: index, error: "Popunite sva polja", errors: [] });

  connection.query("INSERT INTO goals (user_id, name, current, target) VALUES (?, ?, 0, ?)", [userId, name, target], (err) => {
    if (err) return res.status(500).send("Greška: " + err.message);
    res.redirect("/profile");
  });
});

router.post("/addgoalbalance", isAuthenticated, async (req, res) => {
  const { goalbalance, goalId } = req.body;
  const userId = req.session.user.id;

  let amount = parseFloat(goalbalance);
  if (isNaN(amount) || amount <= 0) {
    return loadAndRenderProfile(req, res, "Uneli ste nevažeći iznos.");
  }

  const query = `
    SELECT u.balance, g.current, g.target
    FROM users u
    INNER JOIN goals g ON u.id = g.user_id
    WHERE u.id = ? AND g.id = ?
  `;

  connection.query(query, [userId, goalId], (err, results) => {
    if (err) return loadAndRenderProfile(req, res, "Greška baze.");
    if (results.length === 0) return res.redirect("/profile");

    const userBalance = parseFloat(results[0].balance);
    const goalCurrent = parseFloat(results[0].current);
    const goalTarget = parseFloat(results[0].target);

    // korisnik nema dovoljno novca
    if (amount > userBalance) {
      return loadAndRenderProfile(req, res, `Nemate dovoljno novca. Balans: ${userBalance}`);
    }

    // koliko je ostalo do cilja
    const remaining = goalTarget - goalCurrent;
    if (remaining <= 0) {
      return loadAndRenderProfile(req, res, "Cilj je već dostignut.");
    }

    // ako je uneo više nego što je potrebno → skrati na preostali iznos
    if (amount > remaining) {
      amount = remaining;
    }

    const newGoalCurrent = goalCurrent + amount;
    const newUserBalance = userBalance - amount;

    // Ako je cilj dostignut nakon ove transakcije
    if (newGoalCurrent >= goalTarget) {
      const queryDone = `
        UPDATE goals SET completed = 1 WHERE id = ? AND user_id = ?
      `;
      connection.query(queryDone, [goalId, userId], (err2) => {
        if (err2) console.error(err2);
      });

      const achQuery = `
        UPDATE user_achievements
        SET current = 1
        WHERE achievement_id = 4 AND user_id = ?
      `;
      connection.query(achQuery, [userId], (err3) => {
        if (err3) console.error(err3);
      });
    }

    // update daily_saved
    const updateDailySavedQuery = `
      UPDATE users SET daily_saved = daily_saved + ? WHERE id = ?
    `;
    connection.query(updateDailySavedQuery, [amount, userId], err4 => {
      if (err4) console.error(err4);
    });

    // update goal i balans korisnika
    const updateQuery = `
      UPDATE users u
      JOIN goals g ON g.user_id = u.id
      SET g.current = ?, u.balance = ?
      WHERE u.id = ? AND g.id = ?
    `;
    connection.query(updateQuery, [newGoalCurrent, newUserBalance, userId, goalId], (err5) => {
      if (err5) return loadAndRenderProfile(req, res, "Greška pri ažuriranju.");
      res.redirect("/profile");
    });
  });
});

router.post("/changebalance", isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  let { balans } = req.body;
  balans = parseFloat(balans);

  if (isNaN(balans) || balans <= 0) {
    return loadAndRenderProfile(req, res, "Iznos mora biti veći od 0");
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

router.post("/changedailygoal", isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  let { dailyGoal } = req.body;
  dailyGoal = parseFloat(dailyGoal);

  if (isNaN(dailyGoal) || dailyGoal <= 0) {
    return loadAndRenderProfile(req, res, "Dnevni cilj mora biti veći od 0");
  }

  try {
    await new Promise((resolve, reject) => {
      connection.query("UPDATE users SET daily_goal =  ? WHERE id = ?", [dailyGoal, userId], (err) => err ? reject(err) : resolve());
    });
    res.redirect("/profile");
  } catch (err) {
    console.error(err);
    res.status(500).send("Greška pri menjanju dnevnog cilja");
  }
});

module.exports = router;
