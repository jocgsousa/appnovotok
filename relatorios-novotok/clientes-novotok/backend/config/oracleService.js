const oracledb = require('oracledb');
const path = require('path');
const fs = require('fs');

// Oracle Database Configuration
const oracleConfig = require('./oracle.json');

// Initialize Oracle client library
let oracleInitialized = false;

function initializeOracle() {
  if (!oracleInitialized) {
    try {
      // Force use of local Oracle Instant Client to avoid system conflicts
      const instantClientPath = path.join(__dirname, '../instantclient_19_25');
      
      if (fs.existsSync(instantClientPath)) {
        console.log('Initializing Oracle client with local path:', instantClientPath);
        
        // Check if oci.dll exists in the path
        const ociPath = path.join(instantClientPath, 'oci.dll');
        if (!fs.existsSync(ociPath)) {
          throw new Error(`Oracle Client library not found at: ${ociPath}`);
        }
        
        oracledb.initOracleClient({ 
          libDir: instantClientPath 
        });
        
        oracleInitialized = true;
        console.log('Oracle client initialized successfully with local instantclient');
      } else {
        throw new Error(`Oracle Instant Client directory not found at: ${instantClientPath}`);
      }
    } catch (error) {
      console.error('Oracle client initialization error:', error);
      console.error('Please ensure Oracle Instant Client 19.25 (64-bit) is properly installed in the instantclient_19_25 directory');
      throw error;
    }
  }
}

class OracleService {
  constructor() {
    initializeOracle();
  }

  async getConnection() {
    try {
      const connection = await oracledb.getConnection({
        user: oracleConfig.user,
        password: oracleConfig.password,
        connectString: `${oracleConfig.host}/${oracleConfig.database}`,
        poolMax: oracleConfig.connectionLimit || 10
      });
      
      return connection;
    } catch (error) {
      console.error('Oracle connection error:', error);
      throw error;
    }
  }

  async testConnection() {
    let connection;
    
    try {
      console.log('Testing Oracle DB connection...');
      console.log('Connection string:', `${oracleConfig.host}/${oracleConfig.database}`);
      
      connection = await this.getConnection();
      
      // Test query
      const result = await connection.execute('SELECT 1 FROM DUAL');
      
      console.log('Oracle connection test successful');
      
      return {
        success: true,
        message: 'Conexão com a base de dados Oracle estabelecida com sucesso!'
      };
      
    } catch (error) {
      console.error('Oracle connection test failed:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (error) {
          console.error('Error closing test connection:', error);
        }
      }
    }
  }

  async executeQuery(sql, params = {}, options = {}) {
    let connection;
    
    try {
      connection = await this.getConnection();
      
      const defaultOptions = {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        ...options
      };
      
      const result = await connection.execute(sql, params, defaultOptions);
      
      return {
        success: true,
        data: result.rows,
        rowCount: result.rows.length
      };
      
    } catch (error) {
      console.error('Oracle query execution error:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (error) {
          console.error('Error closing connection:', error);
        }
      }
    }
  }

  // Product lookup
  async lookupProducts(searchTerm) {
    const sql = `
      SELECT codprod, descricao
      FROM pcprodut
      WHERE (:descricao IS NULL OR UPPER(descricao) LIKE '%' || UPPER(:descricao) || '%')
      ORDER BY descricao
    `;
    
    return this.executeQuery(sql, { 
      descricao: searchTerm || null 
    });
  }

  // Branch lookup
  async lookupBranches(codigo) {
    const sql = `
      SELECT CODIGO, FANTASIA 
      FROM PCFILIAL 
      WHERE (:codigo IS NULL OR codigo = :codigo)
      AND codigo <> '99' 
      ORDER BY codigo
    `;
    
    return this.executeQuery(sql, { 
      codigo: codigo || null 
    });
  }

  // Department lookup
  async lookupDepartments() {
    const sql = `
      SELECT CODEPTO, DESCRICAO 
      FROM PCDEPTO 
      WHERE CODEPTO != '9999'
      ORDER BY DESCRICAO
    `;
    
    return this.executeQuery(sql);
  }

  // Activity lookup
  async lookupActivities() {
    const sql = `
      SELECT CODATIV, RAMO 
      FROM PCATIVI
      ORDER BY RAMO
    `;
    
    return this.executeQuery(sql);
  }

  // Brand lookup
  async lookupBrands(searchTerm, codmarca) {
    const sql = `
      SELECT codmarca, marca, ativo, codadwords 
      FROM pcmarca
      WHERE (:marca IS NULL OR UPPER(marca) LIKE '%' || UPPER(:marca) || '%')
        AND (:codmarca IS NULL OR codmarca LIKE :codmarca)
      ORDER BY marca
    `;
    
    return this.executeQuery(sql, { 
      marca: searchTerm || null,
      codmarca: codmarca || null 
    });
  }

  // Main client report query
  async executeClientQuery(filters) {
    console.log('Executing Oracle client query with filters:', filters);
    
    // Build the SQL query with client records - matching original query structure
    const sql = `
      WITH CODPRODUTO_SPLIT AS (
          SELECT
              TO_NUMBER(TRIM(REGEXP_SUBSTR(:CODPRODUTO, '[^,]+', 1, LEVEL))) AS CODPROD
          FROM
              DUAL
          CONNECT BY
              REGEXP_SUBSTR(:CODPRODUTO, '[^,]+', 1, LEVEL) IS NOT NULL
      )
      SELECT 
          PCPEDC.CODCLI, 
          PCCLIENT.CLIENTE,
          PCCLIENT.CGCENT,
          PCCLIENT.CLASSEVENDA,
          PCCLIENT.ENDERENT, 
          REGEXP_REPLACE(PCCLIENT.TELCELENT, '[^0-9]', '') AS TELCELENT, 
          PCCLIENT.BAIRROENT,
          PCCLIENT.MUNICENT, 
          PCCLIENT.ESTENT, 
          PCPEDC.CODUSUR AS CODUSUR1, 
          PCCLIENT.CODUSUR2,
          SUM(PCPEDI.QT) AS QT,
          SUM(
              CASE
                  WHEN NVL(PCPEDI.BONIFIC, 'N') = 'N' THEN 
                      DECODE(
                          PCPEDC.CONDVENDA,
                          5, 0,
                          6, 0,
                          11, 0,
                          12, 0,
                          NVL(PCPEDI.VLSUBTOTITEM,
                              DECODE(
                                  NVL(PCPEDI.TRUNCARITEM, 'N'),
                                  'N', ROUND(
                                      NVL(PCPEDI.QT, 0) *
                                      (NVL(PCPEDI.PVENDA, 0) + NVL(PCPEDI.VLOUTRASDESP, 0) + NVL(PCPEDI.VLFRETE, 0)),
                                      2
                                  ),
                                  TRUNC(
                                      NVL(PCPEDI.QT, 0) *
                                      (NVL(PCPEDI.PVENDA, 0) + NVL(PCPEDI.VLOUTRASDESP, 0) + NVL(PCPEDI.VLFRETE, 0)),
                                      2
                                  )
                              )
                          )
                      )
                  ELSE 0
              END
          ) -
          SUM(
              CASE
                  WHEN NVL(PCPEDI.BONIFIC, 'N') = 'N' THEN 
                      DECODE(
                          PCPEDC.CONDVENDA,
                          5, 0,
                          6, 0,
                          11, 0,
                          12, 0,
                          NVL(PCPEDI.QT, 0) * (0 + 0)
                      )
                  ELSE 0
              END
          ) AS VLVENDA,
          SUM(NVL(PCPEDI.QT, 0) * NVL(PCPEDI.VLCUSTOFIN, 0)) AS VLCUSTOFIN,
          SUM(NVL(PCPRODUT.PESOBRUTO, 0) * NVL(PCPEDI.QT, 0)) AS TOTPESO
      FROM 
          PCPEDC
      LEFT JOIN 
          PCCLIENT ON PCPEDC.CODCLI = PCCLIENT.CODCLI
      JOIN 
          PCPEDI ON PCPEDI.NUMPED = PCPEDC.NUMPED
      JOIN 
          PCUSUARI ON PCPEDC.CODUSUR = PCUSUARI.CODUSUR
      JOIN 
          PCPRODUT ON PCPEDI.CODPROD = PCPRODUT.CODPROD
      LEFT JOIN 
          PCDEPTO ON PCPRODUT.CODEPTO = PCDEPTO.CODEPTO
      JOIN 
          PCSUPERV ON PCPEDC.CODSUPERVISOR = PCSUPERV.CODSUPERVISOR
      JOIN 
          PCPRACA ON PCPEDC.CODPRACA = PCPRACA.CODPRACA
      LEFT JOIN 
          CODPRODUTO_SPLIT ON PCPEDI.CODPROD = CODPRODUTO_SPLIT.CODPROD
      WHERE 
          PCCLIENT.TELCELENT != '000000000'
          AND (:PRODUTOSCONSULTA IS NULL OR PCCLIENT.TELCELENT != :PRODUTOSCONSULTA)
          AND (:CODEPTO IS NULL OR PCPRODUT.CODEPTO = :CODEPTO)
          AND PCPEDC.DTCANCEL IS NULL
          AND (:ATIVIDADE IS NULL OR PCCLIENT.CODATV1 = :ATIVIDADE)
          AND (:CODMARCA IS NULL OR PCPRODUT.CODMARCA IN (
              SELECT TO_NUMBER(TRIM(REGEXP_SUBSTR(:CODMARCA, '[^,]+', 1, LEVEL))) 
              FROM DUAL 
              CONNECT BY REGEXP_SUBSTR(:CODMARCA, '[^,]+', 1, LEVEL) IS NOT NULL
          ))
          AND (PCPEDC.DATA BETWEEN TO_DATE(:DATAINICIO, 'DD/MM/YYYY') AND TO_DATE(:DATAFIM, 'DD/MM/YYYY'))
          AND (PCPEDI.DATA BETWEEN TO_DATE(:DATAINICIO, 'DD/MM/YYYY') AND TO_DATE(:DATAFIM, 'DD/MM/YYYY'))
          AND (:FILIAL IS NULL OR PCPEDC.CODFILIAL IN (
              SELECT TO_NUMBER(TRIM(REGEXP_SUBSTR(:FILIAL, '[^,]+', 1, LEVEL))) 
              FROM DUAL 
              CONNECT BY REGEXP_SUBSTR(:FILIAL, '[^,]+', 1, LEVEL) IS NOT NULL
          ))
          AND PCPEDC.CONDVENDA NOT IN (4, 5, 6, 8, 10, 11, 12, 13, 16, 20)
      GROUP BY 
          PCPEDC.CODCLI, 
          PCCLIENT.CLIENTE,
          PCCLIENT.ENDERENT,
          PCCLIENT.TELCELENT, 
          PCCLIENT.BAIRROENT,
          PCCLIENT.MUNICENT, 
          PCCLIENT.ESTENT, 
          PCPEDC.CODUSUR, 
          PCCLIENT.CODUSUR2,
          PCCLIENT.CGCENT,
          PCCLIENT.CLASSEVENDA
      ORDER BY 
          VLVENDA DESC
    `;

    // Format parameters for Oracle
    const params = {
      DATAINICIO: filters.startDate || null,
      DATAFIM: filters.endDate || null,
      FILIAL: filters.branch || null,
      CODEPTO: filters.department || null,
      ATIVIDADE: filters.activity || null,
      CODMARCA: filters.brand || null,
      CODPRODUTO: filters.productCode || null,
      PRODUTOSCONSULTA: filters.consultProducts || null
    };
    
    console.log('Oracle query parameters:', params);

    const result = await this.executeQuery(sql, params);
    
    if (result.success) {
      // Additional client-side validation and duplicate removal
      const originalCount = result.data.length;
      
      // First filter for valid phone numbers
      const phoneValidatedData = result.data
        .filter(row => {
          // Validate phone number
          const phone = row.TELCELENT;
          if (!phone) return false;
          
          // Remove non-numeric characters
          const cleanPhone = phone.replace(/[^0-9]/g, '');
          
          // Check if phone has at least 8 digits
          return cleanPhone.length >= 8;
        });
      
      const phoneFilteredCount = originalCount - phoneValidatedData.length;
      
      // Then remove duplicates
      const validatedData = phoneValidatedData
        .reduce((unique, row) => {
          // Remove duplicates based on CODCLI + TELCELENT combination
          const key = `${row.CODCLI}_${row.TELCELENT}`;
          if (!unique.find(item => `${item.CODCLI}_${item.TELCELENT}` === key)) {
            unique.push(row);
          }
          return unique;
        }, []);
      
      const duplicatesCount = phoneValidatedData.length - validatedData.length;

      return {
        success: true,
        data: validatedData,
        rowCount: validatedData.length,
        originalRowCount: originalCount,
        phoneFilteredCount: phoneFilteredCount,
        duplicatesCount: duplicatesCount
      };
    }
    
    return result;
  }
}

module.exports = new OracleService();