const { body } = require("express-validator");

const loginValidation = [
  body("username")
    .notEmpty().withMessage("Korisničko ime je obavezno!"),
  body("password")
    .notEmpty().withMessage("Lozinka je obavezna!")
];

module.exports = loginValidation;