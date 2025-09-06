const connection = require("../../controller/config"); // your MySQL connection

/**
 * Checks if user's goals are met and updates streak,
 * then resets the daily progress for the next day.
 */

const updateAllStreaks = () => {
    db.query("SELECT id FROM users", (err, results) => {
      if (err) return console.error(err);
      results.forEach(row => checkDailyStreak(row.id));
    });
  };
  
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
    const goals = results.map(r => ({ id: r.goal_id, current: r.current, target: r.target }));

    const lastUpdate = last_goal_update ? new Date(last_goal_update) : null;
    const diffInMs = lastUpdate ? now - lastUpdate : null;
    const diffInDays = diffInMs ? diffInMs / (1000 * 60 * 60 * 24) : null;

    // Check if all goals were met today
    const allGoalsMet = goals.every(g => g.current >= g.target);

    // Update streak
    if (lastUpdate && diffInDays >= 1 && !allGoalsMet) {
      streak = 0; // Missed a day → reset streak
    } else if (allGoalsMet) {
      streak = (streak || 0) + 1; // Goal met → increment streak
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
      console.log(`User ${userId}'s daily goals reset for the next day`);
    });
  });
};

