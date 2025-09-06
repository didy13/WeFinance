const { body } = require('express-validator');

const registerValidation = [
    body('username')
        .notEmpty()
        .withMessage('Username je obavezan')
        .isLength({ min: 3 })
        .withMessage('Username mora imati najmanje 3 karaktera'),
    body('password')
        .notEmpty()
        .withMessage('Password je obavezan')
        .isLength({ min: 6 })
        .withMessage('Password mora imati najmanje 6 karaktera')
];

module.exports = registerValidation;
