const sequelize = require('../config/database');
const User = require('./User');

// Export all models
const models = {
  User,
  sequelize
};

// Initialize associations if any
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

module.exports = models;