let connection;

class Korisnik {
    constructor(username, password) {
        this.username = username;
        this.password = password;
    }

    static setConnection(conn) {
        connection = conn;
    }

    async save() {
    return new Promise((resolve, reject) => {
        connection.query(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            [this.username, this.password],
            (err, result) => {
                if (err) return reject(err);
                resolve(result.insertId); // 🔥 samo insertId, ne ceo objekat
            }
        );
    });
}

    static findByUsername(username) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM users WHERE username = ?';
            connection.query(query, [username], (err, results) => {
                if (err) return reject(err);
                resolve(results[0]);
            });
        });
    }

    delete() {
        const query = 'DELETE FROM users WHERE username = ?';
        return new Promise((resolve, reject) => {
            connection.query(query, [this.username], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }
}

module.exports = Korisnik;
