let connection;
class Korisnik {
    constructor(ime, prezime, nickname, email, lozinka, datumRodjenja) {
      this.ime = ime;
      this.prezime = prezime;
      this.nickname = nickname;
      this.email = email;
      this.lozinka = lozinka;
      this.datumRodjenja = datumRodjenja;
    }
    static setConnection(conn)
    {
        connection = conn;
    }
    save() 
    {
        const query = 'INSERT INTO Korisnik (ime, prezime, nickname, email, lozinka, datumRodjenja) VALUES (?, ?, ?, ?, ?, ?)';
        const values = [this.ime, this.prezime, this.nickname, this.email, this.lozinka, this.datumRodjenja];
    
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
      const query = 'DELETE FROM Korisnik WHERE email = ?';
      const values = [this.email]; 
  
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