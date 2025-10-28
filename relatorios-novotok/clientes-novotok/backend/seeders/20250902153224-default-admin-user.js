'use strict';

const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Check if admin user already exists
    const existingAdmin = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE email = 'admin@novotok.com' OR nickname = 'admin' LIMIT 1;",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (existingAdmin.length === 0) {
      // Hash the password
      const hashedPassword = await bcrypt.hash('1234', 10);
      
      await queryInterface.bulkInsert('users', [
        {
          name: 'Administrador',
          nickname: 'admin',
          email: 'admin@novotok.com',
          password: hashedPassword,
          must_change_password: true,
          role: 'admin',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        }
      ], {});
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', {
      email: 'admin@novotok.com'
    }, {});
  }
};
