const express = require('express');
const router = express.Router();
const OracleController = require('../controllers/OracleController');

// Oracle routes
router.get('/test-connection', OracleController.testConnection);
router.post('/query', OracleController.executeQuery);

// Lookup routes
router.get('/products', OracleController.lookupProducts);
router.get('/branches', OracleController.lookupBranches);
router.get('/departments', OracleController.lookupDepartments);
router.get('/activities', OracleController.lookupActivities);
router.get('/brands', OracleController.lookupBrands);

module.exports = router;