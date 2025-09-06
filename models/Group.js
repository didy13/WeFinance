let connection;

class Group {
    constructor(name) {
        this.name = name;
    }

    static setConnection(conn) {
        connection = conn;
    }

    // Sačuvaj novu grupu
    save() {
        const query = "INSERT INTO table_group (name) VALUES (?)";
        return new Promise((resolve, reject) => {
            connection.query(query, [this.name], (err, results) => {
                if (err) return reject(err);
                resolve(results.insertId);
            });
        });
    }

    // Dohvati sve grupe u kojima je korisnik član
    static getUserGroups(userId) {
        const query = `
            SELECT g.id, g.name
            FROM table_group g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_id = ?
        `;
        return new Promise((resolve, reject) => {
            connection.query(query, [userId], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }

    // Dohvati sve članove grupe
    static getMembers(groupId) {
        const query = `
            SELECT u.id, u.username, u.streak, u.balance
            FROM users u
            JOIN group_members gm ON u.id = gm.user_id
            WHERE gm.group_id = ?
        `;
        return new Promise((resolve, reject) => {
            connection.query(query, [groupId], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }

    // Pošalji pozivnicu korisniku
    static inviteMember(groupId, userId, inviterId) {
        const query = "INSERT INTO group_invites (group_id, user_id, inviter_id) VALUES (?, ?, ?)";
        return new Promise((resolve, reject) => {
            connection.query(query, [groupId, userId, inviterId], (err, results) => {
                if (err) return reject(err);
                resolve(results.insertId);
            });
        });
    }

    // Dohvati sve pozivnice za korisnika
    static getUserInvites(userId) {
        const query = `
            SELECT gi.id, gi.group_id, gi.inviter_id, g.name AS group_name
            FROM group_invites gi
            JOIN table_group g ON gi.group_id = g.id
            WHERE gi.user_id = ?
        `;
        return new Promise((resolve, reject) => {
            connection.query(query, [userId], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }

    // Prihvati pozivnicu i briše je
    static acceptInvite(inviteId) {
        return new Promise((resolve, reject) => {
            const selectQuery = "SELECT group_id, user_id FROM group_invites WHERE id = ?";
            connection.query(selectQuery, [inviteId], (err, results) => {
                if (err) return reject(err);
                if (results.length === 0) return reject(new Error("Pozivnica ne postoji"));

                const { group_id, user_id } = results[0];

                const insertQuery = "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)";
                connection.query(insertQuery, [group_id, user_id], (err2) => {
                    if (err2) return reject(err2);

                    const deleteQuery = "DELETE FROM group_invites WHERE id = ?";
                    connection.query(deleteQuery, [inviteId], (err3) => {
                        if (err3) return reject(err3);
                        resolve();
                    });
                });
            });
        });
    }

    // Odbij pozivnicu i briše je
    static declineInvite(inviteId) {
        const query = "DELETE FROM group_invites WHERE id = ?";
        return new Promise((resolve, reject) => {
            connection.query(query, [inviteId], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }
}

module.exports = Group;
