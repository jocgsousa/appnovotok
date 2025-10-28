const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const {
  validate,
  userValidationRules,
  userUpdateValidationRules,
  loginValidationRules,
  changePasswordValidationRules
} = require('../middleware/validation');

// User routes
router.post('/', userValidationRules(), validate, UserController.create);
router.get('/', UserController.getAll);
router.get('/:id', UserController.getById);
router.put('/:id', userUpdateValidationRules(), validate, UserController.update);
router.delete('/:id', UserController.delete);

// Authentication routes
router.post('/login', loginValidationRules(), validate, UserController.login);
router.put('/:id/change-password', changePasswordValidationRules(), validate, UserController.changePassword);

module.exports = router;