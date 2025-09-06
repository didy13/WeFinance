const connection = require("../controller/config"); // your MySQL connection

/**
 * Check goals for a single user and update streak.
 * @param {number} userId
 */
const checkDailyStreak = (userId) => {
  const now = new Date();

  // Fetch user's streak, last update, and their goals
  const query = `
    SELECT u.streak, u.last_goal_update, g.id AS goal_id, g.current, g.target
    FROM users u
    LEFT JOIN goals g ON u.id = g.user_id
    WHERE u.id = ?
  `;

  connection.query(query, [userId], (err, results) => {
    if (err) return console.error(err);
    if (!results.length) return;

    let { streak, last_goal_update } = results[0];
    const goals = results.map(r => ({ current: r.current, target: r.target }));

    const lastUpdate = last_goal_update ? new Date(last_goal_update) : null;
    const diffInMs = lastUpdate ? now - lastUpdate : null;
    const diffInDays = diffInMs ? diffInMs / (1000 * 60 * 60 * 24) : null;

    // Check if all goals are satisfied
    const allGoalsMet = goals.every(g => g.current >= g.target);

    if (lastUpdate && diffInDays >= 1 && !allGoalsMet) {
      streak = 0; // missed a day → reset streak
    } else if (allGoalsMet) {
      streak = (streak || 0) + 1; // all goals met → increment streak
    }

    // Update user's streak and last_goal_update
    const updateUserQuery = `
      UPDATE users
      SET streak = ?, last_goal_update = ?
      WHERE id = ?
    `;
    connection.query(updateUserQuery, [streak, now, userId], (err) => {
      if (err) return console.error(err);
      console.log(`User ${userId} streak updated to ${streak}`);
    });

    // Reset all goals' current progress for the next day
    const resetGoalsQuery = `
      UPDATE goals
      SET current = 0
      WHERE user_id = ?
    `;
    connection.query(resetGoalsQuery, [userId], (err) => {
      if (err) return console.error(err);
      console.log(`User ${userId}'s goals reset for the next day`);
    });
  });
};

/**
 * Loop through all users and update streaks (for cron job)
 */
const updateAllStreaks = () => {
  connection.query("SELECT id FROM users", (err, results) => {
    if (err) return console.error(err);
    results.forEach(row => checkDailyStreak(row.id));
  });
};

module.exports = {
  checkDailyStreak,
  updateAllStreaks
};
