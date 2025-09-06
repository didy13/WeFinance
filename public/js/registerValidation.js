const { body } = require('express-validator');

const registerValidation = [
    body('username')
        .notEmpty()
        .withMessage('Korisničko ime je obavezno!')
        .isLength({ min: 3 })
        .withMessage('Korisničko ime mora da ima najmanje 3 karaktera!'),
    body('password')
        .notEmpty()
        .withMessage('Lozinka je obavezna!')
        .isLength({ min: 6 })
        .withMessage('Lozinka mora da ima najmanje 6 karaktera!')
        .matches(/(?=.*[A-Z])(?=.*[0-9])/)
        .withMessage('Lozinka mora da ima bar jedno veliko slovo i bar jedan broj!'),
];

module.exports = registerValidation;

