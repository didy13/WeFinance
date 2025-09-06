const { body } = require('express-validator');

const registerValidation = [
    body('ime').notEmpty().withMessage('Ime je obavezno'),
    body('prezime').notEmpty().withMessage('Prezime je obavezno'),
    body('nickname').notEmpty().withMessage('Nickname je obavezan'),
    body('email').isEmail().withMessage('Email nije validan'),
    body('lozinka').isLength({ min: 6 }).withMessage('Lozinka mora imati minimum 6 karaktera')
];

module.exports = registerValidation;