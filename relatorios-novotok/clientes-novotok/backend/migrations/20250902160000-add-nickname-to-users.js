'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, add nickname column as nullable
    await queryInterface.addColumn('users', 'nickname', {
      type: Sequelize.STRING(50),
      allowNull: true,
      after: 'name'
    });

    // Update existing users with a nickname based on their email
    const users = await queryInterface.sequelize.query(
      'SELECT id, email FROM users WHERE nickname IS NULL',
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const user of users) {
      // Extract username part from email and make it unique
      let nickname = user.email.split('@')[0];
      
      // Ensure nickname contains only valid characters
      nickname = nickname.replace(/[^a-zA-Z0-9_]/g, '_');
      
      // Check if nickname already exists and make it unique if needed
      let finalNickname = nickname;
      let counter = 1;
      
      while (true) {
        const existingNickname = await queryInterface.sequelize.query(
          'SELECT id FROM users WHERE nickname = ? AND id != ?',
          {
            replacements: [finalNickname, user.id],
            type: Sequelize.QueryTypes.SELECT
          }
        );

        if (existingNickname.length === 0) {
          break;
        }
        
        finalNickname = `${nickname}_${counter}`;
        counter++;
      }

      await queryInterface.sequelize.query(
        'UPDATE users SET nickname = ? WHERE id = ?',
        {
          replacements: [finalNickname, user.id],
          type: Sequelize.QueryTypes.UPDATE
        }
      );
    }

    // Now make the column NOT NULL and add unique constraint
    await queryInterface.changeColumn('users', 'nickname', {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true
    });

    // Add index for nickname
    await queryInterface.addIndex('users', ['nickname'], {
      unique: true,
      name: 'users_nickname_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index
    await queryInterface.removeIndex('users', 'users_nickname_unique');
    
    // Remove nickname column
    await queryInterface.removeColumn('users', 'nickname');
  }
};