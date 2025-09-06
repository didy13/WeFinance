let connection;

class Goal {
    constructor(name, type, target_amount, created_by, group_id = null) {
        this.name = name;
        this.target_amount = target_amount;
        this.current_amount = 0;
        this.created_by = created_by;
    }

    static setConnection(conn) {
        connection = conn;
    }

    save() {
        const query = 'INSERT INTO goals (name, target, current, user_id) VALUES (?, ?, ?, ?)';
        const values = [this.name, this.target_amount, this.current_amount, this.created_by];
        return new Promise((resolve, reject) => {
            connection.query(query, values, (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }

    static getAllByUser(user_id) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM goals WHERE created_by = ? OR group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)';
            connection.query(query, [user_id, user_id], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }

    static getById(id) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM goals WHERE id = ?';
            connection.query(query, [id], (err, results) => {
                if (err) return reject(err);
                resolve(results[0]);
            });
        });
    }

    static updateCurrentAmount(goal_id, new_amount) {
        return new Promise((resolve, reject) => {
            const query = 'UPDATE goals SET current_amount = ? WHERE id = ?';
            connection.query(query, [new_amount, goal_id], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }
}

module.exports = Goal;
