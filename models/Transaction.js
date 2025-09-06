let connection;

class Transaction {
    constructor(user_id, goal_id, amount) {
        this.user_id = user_id;
        this.goal_id = goal_id;
        this.amount = amount;
    }

    static setConnection(conn) {
        connection = conn;
    }

    save() {
        const query = 'INSERT INTO transactions (user_id, goal_id, amount) VALUES (?, ?, ?)';
        return new Promise((resolve, reject) => {
            connection.query(query, [this.user_id, this.goal_id, this.amount], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }

    static getAllForGoal(goal_id) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM transactions WHERE goal_id = ?';
            connection.query(query, [goal_id], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }
}

module.exports = Transaction;
