let connection;

class Group {
    constructor(name) {
        this.name = name;
    }

    static setConnection(conn) {
        connection = conn;
    }

    async save() {
        return new Promise((resolve, reject) => {
            const query = "INSERT INTO table_group (name) VALUES (?)";
            connection.query(query, [this.name], (err, result) => {
                if (err) return reject(err);
                resolve(result.insertId);
            });
        });
    }

    static async getUserGroups(userId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT g.*, 
                       (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members_count
                FROM table_group g
                WHERE g.id IN (SELECT group_id FROM group_members WHERE user_id = ?)`;
            connection.query(query, [userId], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }
}

module.exports = Group;
