let connection;

class Group {
    constructor(name, description, created_by) {
        this.name = name;
        this.description = description;
        this.created_by = created_by;
    }

    static setConnection(conn) {
        connection = conn;
    }

    save() {
        const query = 'INSERT INTO groups (name, description, created_by) VALUES (?, ?, ?)';
        const values = [this.name, this.description, this.created_by];
        return new Promise((resolve, reject) => {
            connection.query(query, values, (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }

    static getAllForUser(user_id) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT g.* 
                FROM groups g 
                JOIN group_members gm ON g.id = gm.group_id 
                WHERE gm.user_id = ?
            `;
            connection.query(query, [user_id], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }

    static getById(id) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM groups WHERE id = ?';
            connection.query(query, [id], (err, results) => {
                if (err) return reject(err);
                resolve(results[0]);
            });
        });
    }

    static addMember(group_id, user_id) {
        return new Promise((resolve, reject) => {
            const query = 'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)';
            connection.query(query, [group_id, user_id], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }
}

module.exports = Group;
