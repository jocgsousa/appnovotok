const oracleService = require('../config/oracleService');

class OracleController {
  // Format date for Oracle database
  static formatDateForOracle(dateString) {
    if (!dateString) return null;
    
    // Handle both YYYY-MM-DD and ISO date string formats
    let year, month, day;
    
    if (dateString.includes('T')) {
      // ISO date string format (e.g., "2024-09-02T00:00:00.000Z")
      // Extract only the date part to avoid timezone issues
      const datePart = dateString.split('T')[0];
      [year, month, day] = datePart.split('-');
    } else {
      // YYYY-MM-DD format
      [year, month, day] = dateString.split('-');
    }
    
    // Format as DD/MM/YYYY for Oracle
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  // Test Oracle connection
  async testConnection(req, res) {
    try {
      const result = await oracleService.testConnection();
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Erro ao conectar com a base de dados Oracle',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Test connection error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Execute client query
  async executeQuery(req, res) {
    try {
      const filters = req.body;
      
      console.log('Received query filters:', filters);
      
      // Validate required fields
      if (!filters.startDate || !filters.endDate) {
        return res.status(400).json({
          success: false,
          message: 'Datas de início e fim são obrigatórias'
        });
      }

      // Validate date range using string comparison (YYYY-MM-DD format)
      if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
        return res.status(400).json({
          success: false,
          message: 'A data de início deve ser anterior à data de fim'
        });
      }

      // Convert date strings to Oracle date format
      const processedFilters = {
        ...filters,
        startDate: filters.startDate ? OracleController.formatDateForOracle(filters.startDate) : null,
        endDate: filters.endDate ? OracleController.formatDateForOracle(filters.endDate) : null
      };

      const result = await oracleService.executeClientQuery(processedFilters);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          rowCount: result.rowCount,
          originalRowCount: result.originalRowCount,
          phoneFilteredCount: result.phoneFilteredCount,
          duplicatesCount: result.duplicatesCount,
          message: `Consulta executada com sucesso! ${result.rowCount} registros encontrados.`
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Erro ao executar consulta Oracle',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Execute query error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Lookup products
  async lookupProducts(req, res) {
    try {
      const { searchTerm } = req.query;
      
      const result = await oracleService.lookupProducts(searchTerm);
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Erro ao buscar produtos',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Product lookup error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Lookup branches
  async lookupBranches(req, res) {
    try {
      const { codigo } = req.query;
      
      const result = await oracleService.lookupBranches(codigo);
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Erro ao buscar filiais',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Branch lookup error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Lookup departments
  async lookupDepartments(req, res) {
    try {
      const result = await oracleService.lookupDepartments();
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Erro ao buscar departamentos',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Department lookup error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Lookup activities
  async lookupActivities(req, res) {
    try {
      const result = await oracleService.lookupActivities();
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Erro ao buscar atividades',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Activity lookup error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Lookup brands
  async lookupBrands(req, res) {
    try {
      const { searchTerm, codmarca } = req.query;
      
      const result = await oracleService.lookupBrands(searchTerm, codmarca);
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Erro ao buscar marcas',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Brand lookup error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new OracleController();