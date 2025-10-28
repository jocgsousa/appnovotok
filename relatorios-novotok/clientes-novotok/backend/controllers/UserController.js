const { User } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

class UserController {
  // Create new user
  async create(req, res) {
    try {
      const { name, email, password, nickname, role = 'user', status = 'active' } = req.body;

      // Validate required fields
      if (!name || !email || !password || !nickname) {
        return res.status(400).json({
          success: false,
          message: 'Nome, email, nickname e senha são obrigatórios'
        });
      }

      // Check if nickname already exists
      const existingNickname = await User.findByNickname(nickname);
      if (existingNickname) {
        return res.status(409).json({
          success: false,
          message: 'Nickname já está em uso'
        });
      }

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email já está em uso'
        });
      }

      // Determine if user must change password
      const mustChangePassword = password === '1234';

      // Create user
      const user = await User.create({
        name,
        email,
        nickname,
        password,
        must_change_password: mustChangePassword,
        role,
        status
      });

      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso',
        data: user
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get all users with pagination and filtering
  async getAll(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        role = '', 
        status = '' 
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const whereConditions = {};

      // Add search condition
      if (search) {
        whereConditions[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { nickname: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } }
        ];
      }

      // Add role filter
      if (role) {
        whereConditions.role = role;
      }

      // Add status filter
      if (status) {
        whereConditions.status = status;
      }

      const { count, rows: users } = await User.findAndCountAll({
        where: whereConditions,
        offset,
        limit: parseInt(limit),
        order: [['createdAt', 'DESC']],
        attributes: { exclude: ['password'] }
      });

      const totalPages = Math.ceil(count / parseInt(limit));

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalItems: count,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get user by ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id, {
        attributes: { exclude: ['password'] }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Update user
  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, email, nickname, password, role, status } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Check if email is being changed and if it's already in use
      if (email && email !== user.email) {
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'Email já está em uso'
          });
        }
      }

      // Check if nickname is being changed and if it's already in use
      if (nickname && nickname !== user.nickname) {
        const existingNickname = await User.findByNickname(nickname);
        if (existingNickname) {
          return res.status(409).json({
            success: false,
            message: 'Nickname já está em uso'
          });
        }
      }

      // Prepare update data
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (nickname) updateData.nickname = nickname;
      if (password) {
        updateData.password = password; // Will be hashed by model hook
        // If password is being changed, reset must_change_password flag
        updateData.must_change_password = false;
      }
      if (role) updateData.role = role;
      if (status !== undefined) updateData.status = status;

      // Update user
      await user.update(updateData);

      res.json({
        success: true,
        message: 'Usuário atualizado com sucesso',
        data: user
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Delete user (soft delete)
  async delete(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Prevent deletion of the last admin
      if (user.role === 'admin') {
        const adminCount = await User.count({
          where: { role: 'admin' }
        });
        
        if (adminCount <= 1) {
          return res.status(400).json({
            success: false,
            message: 'Não é possível excluir o último administrador'
          });
        }
      }

      // Soft delete
      await user.destroy();

      res.json({
        success: true,
        message: 'Usuário excluído com sucesso'
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { nickname, password, email } = req.body;

      console.log('Login attempt:', { nickname, email, password: password ? '[PROVIDED]' : '[MISSING]' });

      // Support both nickname and email for backward compatibility
      const loginField = nickname || email;
      
      if (!loginField || !password) {
        console.log('Missing credentials:', { loginField: !!loginField, password: !!password });
        return res.status(400).json({
          success: false,
          message: 'Nickname/Email e senha são obrigatórios'
        });
      }

      console.log('Searching for user with loginField:', loginField);

      // Find user by nickname or email (try nickname first, then email for backward compatibility)
      let user = await User.findOne({
        where: { nickname: loginField },
        attributes: ['id', 'name', 'email', 'nickname', 'password', 'role', 'status', 'lastLogin']
      });
      
      console.log('User found by nickname:', user ? `${user.nickname} (${user.email})` : 'null');
      
      // If not found by nickname and looks like email, try email field
      if (!user && loginField.includes('@')) {
        console.log('Trying to find by email:', loginField);
        user = await User.findOne({
          where: { email: loginField },
          attributes: ['id', 'name', 'email', 'nickname', 'password', 'role', 'status', 'lastLogin']
        });
        console.log('User found by email:', user ? `${user.nickname} (${user.email})` : 'null');
      }

      if (!user) {
        console.log('No user found for loginField:', loginField);
        return res.status(401).json({
          success: false,
          message: 'Credenciais inválidas'
        });
      }

      console.log('User status:', user.status);
      // Check if user is active
      if (user.status !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'Usuário inativo'
        });
      }

      console.log('Checking password...');
      // Check password
      const isValidPassword = await user.checkPassword(password);
      console.log('Password valid:', isValidPassword);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Credenciais inválidas'
        });
      }

      console.log('Login successful for user:', user.nickname);
      
      // Check if user needs to change password (password is '1234' or must_change_password flag is true)
      const needsPasswordChange = await user.needsPasswordChange();
      console.log('User needs password change:', needsPasswordChange);

      // Update last login
      await user.update({ lastLogin: new Date() });

      // Remove password from response
      const userResponse = user.toJSON();

      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        data: {
          user: userResponse,
          needsPasswordChange: needsPasswordChange
        }
      });
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Senha atual e nova senha são obrigatórias'
        });
      }

      const user = await User.findByPk(id, {
        attributes: ['id', 'name', 'email', 'password', 'role', 'status', 'must_change_password']
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Verify current password
      const isValidPassword = await user.checkPassword(currentPassword);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: 'Senha atual incorreta'
        });
      }

      // Update password and reset must_change_password flag
      await user.update({ 
        password: newPassword,
        must_change_password: false
      });

      res.json({
        success: true,
        message: 'Senha alterada com sucesso'
      });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new UserController();