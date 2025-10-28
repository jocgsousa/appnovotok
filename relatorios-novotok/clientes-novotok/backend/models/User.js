const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  nickname: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [3, 50],
      is: /^[a-zA-Z0-9_]+$/ // Only alphanumeric characters and underscores
    }
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      notEmpty: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [4, 255]
    }
  },
  must_change_password: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'user'),
    allowNull: false,
    defaultValue: 'user'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active'
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  paranoid: true,
  underscored: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        // Check if the password is the default '1234'
        if (user.password === '1234') {
          user.must_change_password = true;
        }
        
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
        
        // If password is being changed, reset must_change_password flag
        if (user.must_change_password === true) {
          user.must_change_password = false;
        }
      }
    }
  }
});

// Instance methods
User.prototype.checkPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Check if user needs to change password (password is '1234' or must_change_password flag is true)
User.prototype.needsPasswordChange = async function() {
  // Check if the must_change_password flag is set
  if (this.must_change_password === true) {
    return true;
  }
  
  // Fallback to checking if password is '1234'
  return await bcrypt.compare('1234', this.password);
};

User.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password;
  return values;
};

// Class methods
User.findByEmail = async function(email) {
  return await this.findOne({
    where: { email }
  });
};

User.findByNickname = async function(nickname) {
  return await this.findOne({
    where: { nickname }
  });
};

User.findByNicknameOrEmail = async function(identifier) {
  return await this.findOne({
    where: {
      [require('sequelize').Op.or]: [
        { nickname: identifier },
        { email: identifier }
      ]
    }
  });
};

module.exports = User;