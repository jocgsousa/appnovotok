const { body, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }
  next();
};

// User validation rules
const userValidationRules = () => {
  return [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Nome deve ter entre 2 e 100 caracteres'),
    body('nickname')
      .trim()
      .isLength({ min: 3, max: 50 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Nickname deve ter entre 3 e 50 caracteres e conter apenas letras, números e underscore'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email deve ser válido'),
    body('password')
      .isLength({ min: 4 })
      .withMessage('Senha deve ter pelo menos 4 caracteres'),
    body('role')
      .optional()
      .isIn(['admin', 'user'])
      .withMessage('Role deve ser admin ou user'),
    body('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('Status deve ser active ou inactive')
  ];
};

// User update validation rules (password optional)
const userUpdateValidationRules = () => {
  return [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Nome deve ter entre 2 e 100 caracteres'),
    body('nickname')
      .optional()
      .trim()
      .isLength({ min: 3, max: 50 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Nickname deve ter entre 3 e 50 caracteres e conter apenas letras, números e underscore'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Email deve ser válido'),
    body('password')
      .optional()
      .isLength({ min: 4 })
      .withMessage('Senha deve ter pelo menos 4 caracteres'),
    body('role')
      .optional()
      .isIn(['admin', 'user'])
      .withMessage('Role deve ser admin ou user'),
    body('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('Status deve ser active ou inactive')
  ];
};

// Login validation rules
const loginValidationRules = () => {
  return [
    body('nickname')
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage('Nickname deve ser fornecido'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Email deve ser válido se fornecido'),
    body('password')
      .notEmpty()
      .withMessage('Senha é obrigatória')
  ].concat([
    // Custom validation to ensure at least nickname or email is provided
    body().custom((value, { req }) => {
      if (!req.body.nickname && !req.body.email) {
        throw new Error('Nickname ou email deve ser fornecido');
      }
      return true;
    })
  ]);
};

// Change password validation rules
const changePasswordValidationRules = () => {
  return [
    body('currentPassword')
      .notEmpty()
      .withMessage('Senha atual é obrigatória'),
    body('newPassword')
      .isLength({ min: 4 })
      .withMessage('Nova senha deve ter pelo menos 4 caracteres')
  ];
};

module.exports = {
  validate,
  userValidationRules,
  userUpdateValidationRules,
  loginValidationRules,
  changePasswordValidationRules
};