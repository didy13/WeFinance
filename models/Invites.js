let connection;

class Invite {
    constructor(group_id, user_id, inviter_id) {
        this.group_id = group_id;
        this.user_id = user_id;
        this.inviter_id = inviter_id;
    }

    static setConnection(conn) {
        connection = conn;
    }

    async save() {
        return new Promise((resolve, reject) => {
            const query = "INSERT INTO group_invites (group_id, user_id, inviter_id) VALUES (?, ?, ?)";
            connection.query(query, [this.group_id, this.user_id, this.inviter_id], (err, result) => {
                if (err) return reject(err);
                resolve(result.insertId);
            });
        });
    }

    static async getUserInvites(userId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT i.id AS invite_id, g.id AS group_id, g.name AS group_name, u.username AS inviter_name
                FROM group_invites i
                JOIN table_group g ON g.id = i.group_id
                JOIN users u ON u.id = i.inviter_id
                WHERE i.user_id = ?`;
            connection.query(query, [userId], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }

    static async delete(inviteId) {
        return new Promise((resolve, reject) => {
            const query = "DELETE FROM group_invites WHERE id = ?";
            connection.query(query, [inviteId], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }
}

module.exports = Invite;
