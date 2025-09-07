class Expense {
    static connection;

    static setConnection(conn) {
        this.connection = conn;
    }

    constructor(user_id, name, amount) {
        this.user_id = user_id;
        this.name = name;
        this.amount = amount;
    }

    save() {
        return new Promise((resolve, reject) => {
            Expense.connection.query(
                "INSERT INTO expenses (user_id, name, amount) VALUES (?, ?, ?)",
                [this.user_id, this.name, this.amount],
                (err, result) => err ? reject(err) : resolve(result.insertId)
            );
        });
    }

    static getByUser(user_id) {
        return new Promise((resolve, reject) => {
            Expense.connection.query(
                "SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC",
                [user_id],
                (err, results) => err ? reject(err) : resolve(results)
            );
        });
    }

    static delete(id, user_id) {
        return new Promise((resolve, reject) => {
            Expense.connection.query(
                "DELETE FROM expenses WHERE id = ? AND user_id = ?",
                [id, user_id],
                (err) => err ? reject(err) : resolve()
            );
        });
    }
}

module.exports = Expense;
