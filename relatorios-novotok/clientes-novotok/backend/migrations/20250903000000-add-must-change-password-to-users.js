'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add must_change_password column as BOOLEAN with default false
    await queryInterface.addColumn('users', 'must_change_password', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'password'
    });

    // Add index for better query performance
    await queryInterface.addIndex('users', ['must_change_password'], {
      name: 'users_must_change_password_index'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index
    await queryInterface.removeIndex('users', 'users_must_change_password_index');
    
    // Remove must_change_password column
    await queryInterface.removeColumn('users', 'must_change_password');
  }
};