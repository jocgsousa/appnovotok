'use strict';

const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get all users
    const users = await queryInterface.sequelize.query(
      'SELECT id, password FROM users',
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Update users who have '1234' as password
    for (const user of users) {
      const isDefaultPassword = await bcrypt.compare('1234', user.password);
      if (isDefaultPassword) {
        await queryInterface.sequelize.query(
          'UPDATE users SET must_change_password = ? WHERE id = ?',
          { replacements: [true, user.id] }
        );
      }
    }

    console.log(`Updated ${users.length} users, set must_change_password flag for users with default password`);
  },

  async down(queryInterface, Sequelize) {
    // Reset all must_change_password flags
    await queryInterface.sequelize.query(
      'UPDATE users SET must_change_password = false'
    );
  }
};