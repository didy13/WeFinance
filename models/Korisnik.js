let connection;
class Korisnik {
    constructor(username, password) {
      this.username = username;
      this.password = password;
    }
    static setConnection(conn)
    {
        connection = conn;
    }
    save() 
    {
        const query = 'INSERT INTO users (username, password) VALUES (?, ?)';
        const values = [this.username, this.password];
    
        return new Promise((resolve, reject) => {
          connection.query(query, values, (error, results) => {
            if (error) {
              return reject(error);
            }
            resolve(results);
          });
        });
    }
    delete() {
      const query = 'DELETE FROM Korisnik WHERE username = ?';
      const values = [this.username]; 
  
      return new Promise((resolve, reject) => {
          connection.query(query, values, (error, results) => {
              if (error) {
                  return reject(error);
              }
              resolve(results);
          });
      });
  }

    
}
module.exports = Korisnik;