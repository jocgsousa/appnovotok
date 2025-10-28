require('dotenv/config');
const fs = require('fs');
const path = require('path');
const oracledb = require('oracledb');
const axios = require('axios');
const schedule = require('node-schedule');
const moment = require('moment');

// Configuração do Oracle Instant Client
const oracleClientPath = path.resolve(__dirname, 'instantclient_19_25');
oracledb.initOracleClient({ libDir: oracleClientPath });

// Configurações adicionais do Oracle
oracledb.fetchAsString = [oracledb.DATE, oracledb.NUMBER];
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Função para registrar logs no arquivo
function writeLog(message) {
  return false;
  // Criar estrutura de diretórios por data (ano/mês/dia)
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const dia = String(now.getDate()).padStart(2, '0');
  
  // Criar caminho para a pasta de logs
  const logDir = path.resolve(__dirname, 'logs', String(ano), mes, dia);
  
  // Criar diretórios recursivamente se não existirem
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // Definir nome do arquivo de log com a data atual
  const logFileName = `sync_vendas_log_${ano}${mes}${dia}.txt`;
  const logFilePath = path.join(logDir, logFileName);
  
  // Adicionar timestamp e mensagem
  const timestamp = now.toLocaleString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Escrever no arquivo de log
  fs.appendFileSync(logFilePath, logMessage, 'utf8');
}

// Função para depuração de valores numéricos
function debugValores(label, valores) {
  console.log(`\n===== DEBUG ${label} =====`);
  
  if (Array.isArray(valores)) {
    console.log(`Array com ${valores.length} itens`);
    if (valores.length > 0) {
      const amostra = valores[0];
      console.log('Primeiro item:');
      Object.keys(amostra).forEach(key => {
        if (typeof amostra[key] === 'number') {
          console.log(`${key}: ${amostra[key]} (${typeof amostra[key]}) - Representação exata: ${amostra[key].toString()}`);
        }
      });
    }
  } else if (typeof valores === 'object' && valores !== null) {
    Object.keys(valores).forEach(key => {
      if (typeof valores[key] === 'number') {
        console.log(`${key}: ${valores[key]} (${typeof valores[key]}) - Representação exata: ${valores[key].toString()}`);
      }
    });
  }
  
  console.log("========================\n");
  
  // Também registrar no arquivo de log
  writeLog(`DEBUG ${label}: ${JSON.stringify(valores, (key, value) => 
    typeof value === 'number' ? value.toString() : value
  )}`);
}

// Log da URL da API
console.log(`API URL configurada: ${process.env.API_URL}`);
writeLog(`API URL configurada: ${process.env.API_URL}`);

// Função para obter token de autenticação
async function getAuthToken() {
  try {
    console.log(`Tentando autenticar em: ${process.env.API_URL}/login.php`);
    const response = await axios.post(`${process.env.API_URL}/login.php`, {
      email: 'admin@gmail.com',
      password: '@Ntkti1793'
    });

    if (response.data && response.data.success && response.data.token) {
      return response.data.token;
    } else {
      throw new Error('Falha ao obter token de autenticação');
    }
  } catch (error) {
    console.error(`Erro ao obter token: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Dados: ${JSON.stringify(error.response.data)}`);
    }
    writeLog(`Erro ao obter token: ${error.message}`);
    throw error;
  }
}

// Função para obter lista de vendedores
async function getVendedores(token) {
  try {
    const response = await axios.get(`${process.env.API_URL}/listar_vendedores.php`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data && Array.isArray(response.data)) {
      return response.data;
    } else {
      throw new Error('Formato de resposta inválido ao obter vendedores');
    }
  } catch (error) {
    writeLog(`Erro ao obter vendedores: ${error.message}`);
    throw error;
  }
}

// Função para obter dados de vendas diárias do Oracle
async function getVendasDiarias(connection, dataInicial, dataFinal, codFilial, codUsur, codDepartamento = null, codSecao = null) {
  try {
    // Converter as datas para o formato aceito pelo Oracle (DD/MM/YYYY)
    const dataInicialOracle = moment(dataInicial).format('DD/MM/YYYY');
    const dataFinalOracle = moment(dataFinal).format('DD/MM/YYYY');
    
    console.log(`Consultando vendas: Período ${dataInicialOracle} a ${dataFinalOracle}, Filial ${codFilial}, Vendedor ${codUsur}`);
    if (codDepartamento) console.log(`Filtro de departamento: ${codDepartamento}`);
    if (codSecao) console.log(`Filtro de seção: ${codSecao}`);

    // Configurar o formato de saída para datas no Oracle
    await connection.execute(`ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD'`);
    
    // Configurar formato numérico para garantir precisão decimal
    await connection.execute(`ALTER SESSION SET NLS_NUMERIC_CHARACTERS = '.,'`);

    // Modificar a consulta SQL para lidar com os filtros de departamento e seção
    // sem usar o operador IN com arrays que causa o erro ORA-01484
    let sql = `WITH Calculados AS (
        SELECT PCPEDC.DATA, 
               PCPEDC.CODUSUR AS CODUSUR,
               PCUSUARI.NOME,
               SUM(CASE
                     WHEN NVL(PCPEDI.BONIFIC, 'N') = 'N' THEN
                      DECODE(PCPEDC.CONDVENDA,
                             5, 0,
                             6, 0,
                             11, 0,
                             12, 0,
                             NVL(PCPEDI.VLSUBTOTITEM,
                                 DECODE(NVL(PCPEDI.TRUNCARITEM, 'N'),
                                        'N',
                                        ROUND(NVL(PCPEDI.QT, 0) *
                                              (NVL(PCPEDI.PVENDA, 0) +
                                               NVL(PCPEDI.VLOUTRASDESP, 0) +
                                               NVL(PCPEDI.VLFRETE, 0)),
                                              2),
                                        TRUNC(NVL(PCPEDI.QT, 0) *
                                              (NVL(PCPEDI.PVENDA, 0) +
                                               NVL(PCPEDI.VLOUTRASDESP, 0) +
                                               NVL(PCPEDI.VLFRETE, 0)),
                                              2))))
                     ELSE 0
                   END) / COUNT(DISTINCT PCPEDC.NUMPED) AS TICKETMEDIO,
               SUM(DECODE(PCPEDC.CONDVENDA,
                          1, CASE
                               WHEN NVL(PCPEDI.BONIFIC, 'N') <> 'N' THEN 0
                               ELSE NVL(PCPEDI.QT, 0)
                             END,
                          5, 0,
                          6, 0,
                          11, 0,
                          12, 0,
                          NVL(PCPEDI.QT, 0))) / COUNT(DISTINCT PCPEDC.NUMPED) AS MEDIAITENS,
               SUM(NVL(PCPEDI.QT, 0) * NVL(PCPEDI.VLCUSTOFIN, 0)) AS VLCUSTOFIN,
               COUNT(DISTINCT PCCLIENT.CODCLI) AS QTCLIENTE,
               COUNT(DISTINCT PCPEDC.NUMPED) AS QTPED,
               SUM(NVL(PCPEDI.QT, 0) * NVL(PCPEDI.PVENDA, 0)) AS VLVENDADODIA
          FROM PCPEDI
               JOIN PCPEDC ON PCPEDI.NUMPED = PCPEDC.NUMPED
               JOIN PCUSUARI ON PCPEDC.CODUSUR = PCUSUARI.CODUSUR
               JOIN PCPRODUT ON PCPEDI.CODPROD = PCPRODUT.CODPROD
               JOIN PCDEPTO ON PCPRODUT.CODEPTO = PCDEPTO.CODEPTO
               JOIN PCSECAO ON PCPRODUT.CODSEC = PCSECAO.CODSEC
               JOIN PCCLIENT ON PCPEDC.CODCLI = PCCLIENT.CODCLI
               JOIN PCPRACA ON PCPEDC.CODPRACA = PCPRACA.CODPRACA
               JOIN PCFORNEC ON PCPRODUT.CODFORNEC = PCFORNEC.CODFORNEC
               JOIN PCSUPERV ON PCPEDC.CODSUPERVISOR = PCSUPERV.CODSUPERVISOR
         WHERE PCPEDC.DATA BETWEEN TO_DATE(:DATAI, 'DD/MM/YYYY') AND TO_DATE(:DATAF, 'DD/MM/YYYY')
           AND PCPEDI.DATA BETWEEN TO_DATE(:DATAI, 'DD/MM/YYYY') AND TO_DATE(:DATAF, 'DD/MM/YYYY')
           AND PCPEDC.DTCANCEL IS NULL
           AND PCPEDC.CODFILIAL = :CODFILIAL
           AND PCPEDC.CODUSUR = :CODUSUR
           AND PCPEDC.CONDVENDA NOT IN (4, 8, 10, 13, 20, 98, 99)`;
    
    // Adicionar condição para filtro de departamento se existir
    if (codDepartamento) {
      if (Array.isArray(codDepartamento)) {
        // Criar uma condição OR para cada departamento no array
        sql += ` AND (`;
        codDepartamento.forEach((dpto, index) => {
          if (index > 0) sql += ` OR `;
          sql += `PCDEPTO.CODEPTO = ${dpto}`;
        });
        sql += `)`;
      } else {
        sql += ` AND PCDEPTO.CODEPTO = ${codDepartamento}`;
      }
    }
    
    // Adicionar condição para filtro de seção se existir
    if (codSecao) {
      if (Array.isArray(codSecao)) {
        // Criar uma condição OR para cada seção no array
        sql += ` AND (`;
        codSecao.forEach((sec, index) => {
          if (index > 0) sql += ` OR `;
          sql += `PCSECAO.CODSEC = ${sec}`;
        });
        sql += `)`;
      } else {
        sql += ` AND PCSECAO.CODSEC = ${codSecao}`;
      }
    }
    
    sql += `
         GROUP BY PCPEDC.DATA, PCPEDC.CODUSUR, PCUSUARI.NOME
      ),
      Devolucoes AS (
        SELECT PCNFENT.DTENT AS DATA,
               PCNFENT.CODUSURDEVOL AS CODUSUR,
               SUM(DECODE(PCNFENT.VLTOTAL,0,PCESTCOM.VLDEVOLUCAO,PCNFENT.VLTOTAL) - NVL(PCNFENT.VLOUTRAS,0) - NVL(PCNFENT.VLFRETE,0)) AS VLDEVOLUCAO
          FROM PCNFENT
               LEFT JOIN PCESTCOM ON PCNFENT.NUMTRANSENT = PCESTCOM.NUMTRANSENT
               LEFT JOIN PCTABDEV ON PCNFENT.CODDEVOL = PCTABDEV.CODDEVOL
               LEFT JOIN PCCLIENT ON PCNFENT.CODFORNEC = PCCLIENT.CODCLI
               LEFT JOIN PCEMPR ON PCNFENT.CODMOTORISTADEVOL = PCEMPR.MATRICULA
               LEFT JOIN PCUSUARI ON PCNFENT.CODUSURDEVOL = PCUSUARI.CODUSUR
               LEFT JOIN PCSUPERV ON PCUSUARI.CODSUPERVISOR = PCSUPERV.CODSUPERVISOR
               LEFT JOIN PCEMPR FUNC ON PCNFENT.CODFUNCLANC = FUNC.MATRICULA
               LEFT JOIN PCNFSAID ON PCESTCOM.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
               LEFT JOIN PCDEVCONSUM ON PCNFENT.NUMTRANSENT = PCDEVCONSUM.NUMTRANSENT
         WHERE NVL(PCNFENT.CODFILIALNF, PCNFENT.CODFILIAL) = :CODFILIAL
           AND PCNFENT.DTENT BETWEEN TO_DATE(:DATAI, 'DD/MM/YYYY') AND TO_DATE(:DATAF, 'DD/MM/YYYY')
           AND PCNFENT.TIPODESCARGA IN ('6','7','T') 
           AND NVL(PCNFENT.OBS, 'X') <> 'NF CANCELADA'
           AND PCNFENT.CODFISCAL IN ('131','132','231','232','199','299')
           AND EXISTS (
               SELECT 1 FROM PCPRODUT, PCMOV, PCDEPTO, PCSECAO
                WHERE PCMOV.CODPROD = PCPRODUT.CODPROD
                  AND PCPRODUT.CODEPTO = PCDEPTO.CODEPTO
                  AND PCPRODUT.CODSEC = PCSECAO.CODSEC
                  AND PCMOV.NUMTRANSENT = PCNFENT.NUMTRANSENT
                  AND PCMOV.NUMNOTA = PCNFENT.NUMNOTA
                  AND PCMOV.DTCANCEL IS NULL
                  AND NVL(PCNFENT.CODFILIALNF, PCNFENT.CODFILIAL) = :CODFILIAL
                  AND PCNFENT.CODDEVOL = 31
                  AND PCMOV.CODFILIAL = PCNFENT.CODFILIAL`;
    
    // Adicionar condição para filtro de departamento nas devoluções se existir
    if (codDepartamento) {
      if (Array.isArray(codDepartamento)) {
        // Criar uma condição OR para cada departamento no array
        sql += ` AND (`;
        codDepartamento.forEach((dpto, index) => {
          if (index > 0) sql += ` OR `;
          sql += `PCDEPTO.CODEPTO = ${dpto}`;
        });
        sql += `)`;
      } else {
        sql += ` AND PCDEPTO.CODEPTO = ${codDepartamento}`;
      }
    }
    
    // Adicionar condição para filtro de seção nas devoluções se existir
    if (codSecao) {
      if (Array.isArray(codSecao)) {
        // Criar uma condição OR para cada seção no array
        sql += ` AND (`;
        codSecao.forEach((sec, index) => {
          if (index > 0) sql += ` OR `;
          sql += `PCSECAO.CODSEC = ${sec}`;
        });
        sql += `)`;
      } else {
        sql += ` AND PCSECAO.CODSEC = ${codSecao}`;
      }
    }
    
    sql += `
               )
           AND NVL(PCNFSAID.CONDVENDA, 0) NOT IN (4, 8, 10, 13, 20, 98, 99)
           AND PCNFENT.CODUSURDEVOL = :CODUSUR
           AND PCNFENT.CODDEVOL = 31
         GROUP BY PCNFENT.DTENT, PCNFENT.CODUSURDEVOL
      )
      SELECT c.DATA, 
             c.CODUSUR, 
             c.NOME, 
             ROUND(c.MEDIAITENS, 2) AS MEDIAITENS, 
             ROUND(c.TICKETMEDIO, 2) AS TICKETMEDIO,
             c.VLCUSTOFIN,
             c.QTCLIENTE,
             c.QTPED,
             CASE
               WHEN c.MEDIAITENS > 0 THEN ROUND(c.TICKETMEDIO / c.MEDIAITENS, 2)
               ELSE NULL
             END AS VIA,
             c.VLVENDADODIA,
             NVL(d.VLDEVOLUCAO, 0) AS VLDEVOLUCAO,
             (c.VLVENDADODIA - NVL(d.VLDEVOLUCAO, 0)) AS VLFINAL
        FROM Calculados c
        LEFT JOIN Devolucoes d ON c.DATA = d.DATA AND c.CODUSUR = d.CODUSUR
       ORDER BY c.TICKETMEDIO DESC`;

    // Preparar os parâmetros da consulta (sem os arrays)
    const params = {
      DATAI: dataInicialOracle,
      DATAF: dataFinalOracle,
      CODFILIAL: codFilial,
      CODUSUR: codUsur
    };

    const result = await connection.execute(sql, params);

    // Processar os resultados com o novo formato (objeto em vez de array)
    if (!result.rows || result.rows.length === 0) {
      console.log('Nenhum resultado encontrado na consulta Oracle');
      return [];
    }
    
    console.log(`Encontrados ${result.rows.length} registros de vendas`);
    
    const vendasDiarias = result.rows.map(row => {
      return {
        data: row.DATA,
        codusur: row.CODUSUR,
        nome: row.NOME,
        media_itens: Number(row.MEDIAITENS || 0),
        ticket_medio: Number(row.TICKETMEDIO || 0),
        vlcustofin: Number(row.VLCUSTOFIN || 0),
        qtcliente: parseInt(row.QTCLIENTE || 0),
        qtd_pedidos: parseInt(row.QTPED || 0),
        via: Number(row.VIA || 0),
        vlvendadodia: Number(row.VLVENDADODIA || 0),
        vldevolucao: Number(row.VLDEVOLUCAO || 0),
        valor_total: Number(row.VLFINAL || 0)
      };
    });
    
    // Debug dos valores obtidos do Oracle
    debugValores('Valores do Oracle', vendasDiarias);
    
    return vendasDiarias;
  } catch (error) {
    writeLog(`Erro ao obter vendas diárias: ${error.message}`);
    console.error(`Erro na consulta de vendas: ${error.message}`);
    throw error;
  }
}

// Função para verificar se existe venda diária para uma data e vendedor específicos
async function verificarVendaDiaria(token, data, codusur) {
  try {
    console.log(`Verificando venda diária: data=${data}, codusur=${codusur}`);
    const response = await axios.get(
      `${process.env.API_URL}/listar_vendas_diarias.php?data_inicio=${data}&data_fim=${data}&codusur=${codusur}`, 
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (response.data && response.data.success) {
      console.log(`Resposta da API: ${response.data.diasVendas ? response.data.diasVendas.length : 0} registros encontrados`);
      
      if (response.data.diasVendas && response.data.diasVendas.length > 0) {
        // Encontrar o registro para a data específica
        const vendaDiaria = response.data.diasVendas.find(venda => {
          // Converter a data do formato DD/MM/YYYY para YYYY-MM-DD para comparação
          const partesData = venda.data.split('/');
          const dataFormatada = `${partesData[2]}-${partesData[1]}-${partesData[0]}`;
          return dataFormatada === data && venda.codusur === codusur;
        });
        
        if (vendaDiaria) {
          console.log(`Venda diária encontrada para data ${data}, vendedor ${codusur}`);
          return {
            exists: true,
            id: vendaDiaria.id || null
          };
        }
      }
    }
    
    console.log(`Nenhuma venda diária encontrada para data ${data}, vendedor ${codusur}`);
    return { exists: false };
  } catch (error) {
    console.error(`Erro ao verificar venda diária: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Dados: ${JSON.stringify(error.response.data)}`);
    }
    return { exists: false, error: error.message };
  }
}

// Função para verificar se existe venda total para um período e vendedor específicos
async function verificarVendaTotal(token, dataInicio, dataFim, codusur) {
  try {
    console.log(`Verificando venda total: período ${dataInicio} a ${dataFim}, codusur=${codusur}`);
    const response = await axios.get(
      `${process.env.API_URL}/listar_vendas_totais.php?data_inicio=${dataInicio}&data_fim=${dataFim}&codusur=${codusur}`, 
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (response.data && response.data.success) {
      console.log(`Resposta da API: ${response.data.vendas_totais ? response.data.vendas_totais.length : 0} registros encontrados`);
      
      if (response.data.vendas_totais && response.data.vendas_totais.length > 0) {
        // Encontrar o registro para o período específico
        const vendaTotal = response.data.vendas_totais.find(venda => {
          // Converter as datas do formato DD/MM/YYYY para YYYY-MM-DD para comparação
          const partesDataInicio = venda.dataInicio.split('/');
          const partesDataFim = venda.dataFim.split('/');
          const dataInicioFormatada = `${partesDataInicio[2]}-${partesDataInicio[1]}-${partesDataInicio[0]}`;
          const dataFimFormatada = `${partesDataFim[2]}-${partesDataFim[1]}-${partesDataFim[0]}`;
          
          return dataInicioFormatada === dataInicio && 
                 dataFimFormatada === dataFim && 
                 venda.codUsuario === codusur;
        });
        
        if (vendaTotal) {
          console.log(`Venda total encontrada para período ${dataInicio} a ${dataFim}, vendedor ${codusur}`);
          return {
            exists: true,
            id: vendaTotal.id || null
          };
        }
      }
    }
    
    console.log(`Nenhuma venda total encontrada para período ${dataInicio} a ${dataFim}, vendedor ${codusur}`);
    return { exists: false };
  } catch (error) {
    console.error(`Erro ao verificar venda total: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Dados: ${JSON.stringify(error.response.data)}`);
    }
    return { exists: false, error: error.message };
  }
}

// Função para buscar o ID de uma venda diária específica
async function buscarIdVendaDiaria(token, data, codusur) {
  try {
    console.log(`Buscando ID da venda diária: data=${data}, codusur=${codusur}`);
    
    // Formatar a data para o formato do banco de dados (YYYY-MM-DD)
    const dataFormatada = data; // A data já vem no formato YYYY-MM-DD
    
    // Consultar diretamente o banco de dados via API
    const query = `SELECT id FROM vendas_diarias WHERE data = '${dataFormatada}' AND codusur = '${codusur}' LIMIT 1`;
    const response = await axios.post(`${process.env.API_URL}/executar_consulta.php`, 
      { query: query },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (response.data && response.data.success && response.data.result && response.data.result.length > 0) {
      const id = response.data.result[0].id;
      console.log(`ID da venda diária encontrado: ${id}`);
      return { success: true, id: id };
    }
    
    console.log('Nenhum ID de venda diária encontrado');
    return { success: false };
  } catch (error) {
    console.error(`Erro ao buscar ID da venda diária: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Dados: ${JSON.stringify(error.response.data)}`);
    }
    writeLog(`Erro ao buscar ID da venda diária: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Função para buscar o ID de uma venda total específica
async function buscarIdVendaTotal(token, dataInicio, dataFim, codusur) {
  try {
    console.log(`Buscando ID da venda total: período ${dataInicio} a ${dataFim}, codusur=${codusur}`);
    
    // Formatar as datas para o formato do banco de dados (YYYY-MM-DD)
    const dataInicioFormatada = dataInicio; // A data já vem no formato YYYY-MM-DD
    const dataFimFormatada = dataFim; // A data já vem no formato YYYY-MM-DD
    
    // Consultar diretamente o banco de dados via API
    const query = `SELECT id FROM vendas_totais WHERE data_inicio = '${dataInicioFormatada}' AND data_fim = '${dataFimFormatada}' AND codusur = '${codusur}' LIMIT 1`;
    const response = await axios.post(`${process.env.API_URL}/executar_consulta.php`, 
      { query: query },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (response.data && response.data.success && response.data.result && response.data.result.length > 0) {
      const id = response.data.result[0].id;
      console.log(`ID da venda total encontrado: ${id}`);
      return { success: true, id: id };
    }
    
    console.log('Nenhum ID de venda total encontrado');
    return { success: false };
  } catch (error) {
    console.error(`Erro ao buscar ID da venda total: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Dados: ${JSON.stringify(error.response.data)}`);
    }
    writeLog(`Erro ao buscar ID da venda total: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Função para cadastrar ou atualizar venda diária na API
async function cadastrarVendaDiaria(token, vendaDiaria) {
  try {
    // Debug: Verificar valores antes de enviar para a API
    console.log('DEBUG - Valores antes de enviar para API:');
    console.log(`data=${vendaDiaria.data}, codusur=${vendaDiaria.codusur}`);
    console.log(`vlcustofin=${vendaDiaria.vlcustofin} (${typeof vendaDiaria.vlcustofin})`);
    console.log(`vlvendadodia=${vendaDiaria.vlvendadodia} (${typeof vendaDiaria.vlvendadodia})`);
    console.log(`vldevolucao=${vendaDiaria.vldevolucao} (${typeof vendaDiaria.vldevolucao})`);
    console.log(`valor_total=${vendaDiaria.valor_total} (${typeof vendaDiaria.valor_total})`);
    
    // Debug detalhado dos valores
    debugValores('Venda diária para API', vendaDiaria);
    
    // Tentar obter o ID da venda diária, se existir
    const resultado = await buscarIdVendaDiaria(token, vendaDiaria.data, vendaDiaria.codusur);
    
    if (resultado.success && resultado.id) {
      // Registro já existe, atualizar
      console.log(`Atualizando venda diária ID ${resultado.id} para data ${vendaDiaria.data}, vendedor ${vendaDiaria.codusur}`);
      
      const updateData = {
        id: resultado.id,
        ...vendaDiaria
      };
      
      const response = await axios.post(`${process.env.API_URL}/atualizar_venda_diaria.php`, updateData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data && response.data.success) {
        return { success: true, message: 'Venda diária atualizada com sucesso', updated: true };
      } else {
        throw new Error(`Falha ao atualizar venda diária: ${response.data ? response.data.message : 'Resposta inválida'}`);
      }
    } else {
      // Registro não existe, cadastrar novo
      const response = await axios.post(`${process.env.API_URL}/cadastrar_venda_diaria.php`, vendaDiaria, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data && response.data.success) {
        return { success: true, message: 'Venda diária cadastrada com sucesso', updated: false };
      } else {
        throw new Error(`Falha ao cadastrar venda diária: ${response.data ? response.data.message : 'Resposta inválida'}`);
      }
    }
  } catch (error) {
    if (error.response && error.response.status === 409) {
      writeLog(`Venda diária já cadastrada para data ${vendaDiaria.data} e vendedor ${vendaDiaria.codusur}`);
      return { success: false, message: 'Registro já existe' };
    }
    
    writeLog(`Erro ao processar venda diária: ${error.message}`);
    console.error(`Erro ao processar venda diária: ${error.message}`);
    throw error;
  }
}

// Função para cadastrar ou atualizar venda total na API
async function cadastrarVendaTotal(token, vendaTotal) {
  try {
    // Debug: Verificar valores antes de enviar para a API
    console.log('DEBUG - Valores totais antes de enviar para API:');
    console.log(`codusur=${vendaTotal.codusur}, período=${vendaTotal.data_inicio} a ${vendaTotal.data_fim}`);
    console.log(`total_vlcustofin=${vendaTotal.total_vlcustofin} (${typeof vendaTotal.total_vlcustofin})`);
    console.log(`total_vlvendadodia=${vendaTotal.total_vlvendadodia} (${typeof vendaTotal.total_vlvendadodia})`);
    console.log(`total_vldevolucao=${vendaTotal.total_vldevolucao} (${typeof vendaTotal.total_vldevolucao})`);
    console.log(`total_valor=${vendaTotal.total_valor} (${typeof vendaTotal.total_valor})`);
    
    // Debug detalhado dos valores totais
    debugValores('Venda total para API', vendaTotal);
    
    // Tentar obter o ID da venda total, se existir
    const resultado = await buscarIdVendaTotal(token, vendaTotal.data_inicio, vendaTotal.data_fim, vendaTotal.codusur);
    
    if (resultado.success && resultado.id) {
      // Registro já existe, atualizar
      console.log(`Atualizando venda total ID ${resultado.id} para período ${vendaTotal.data_inicio} a ${vendaTotal.data_fim}, vendedor ${vendaTotal.codusur}`);
      
      const updateData = {
        id: resultado.id,
        ...vendaTotal
      };
      
      const response = await axios.post(`${process.env.API_URL}/atualizar_venda_total.php`, updateData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data && response.data.success) {
        return { success: true, message: 'Venda total atualizada com sucesso', updated: true };
      } else {
        throw new Error(`Falha ao atualizar venda total: ${response.data ? response.data.message : 'Resposta inválida'}`);
      }
    } else {
      // Registro não existe, cadastrar novo
      const response = await axios.post(`${process.env.API_URL}/cadastrar_venda_total.php`, vendaTotal, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data && response.data.success) {
        return { success: true, message: 'Venda total cadastrada com sucesso', updated: false };
      } else {
        throw new Error(`Falha ao cadastrar venda total: ${response.data ? response.data.message : 'Resposta inválida'}`);
      }
    }
  } catch (error) {
    if (error.response && error.response.status === 409) {
      writeLog(`Venda total já cadastrada para período ${vendaTotal.data_inicio} a ${vendaTotal.data_fim} e vendedor ${vendaTotal.codusur}`);
      return { success: false, message: 'Registro já existe' };
    }
    
    writeLog(`Erro ao processar venda total: ${error.message}`);
    console.error(`Erro ao processar venda total: ${error.message}`);
    throw error;
  }
}

// Função para calcular totais das vendas diárias
function calcularTotais(vendasDiarias) {
  if (vendasDiarias.length === 0) return null;
  
  const totais = {
    total_qtd_pedidos: 0,
    total_media_itens: 0,
    total_ticket_medio: 0,
    total_vlcustofin: 0,
    total_qtcliente: 0,
    total_via: 0,
    total_vlvendadodia: 0,
    total_vldevolucao: 0,
    total_valor: 0
  };
  
  // Calcular somas para valores que devem ser somados
  vendasDiarias.forEach(venda => {
    // Usar os valores originais sem formatação adicional
    totais.total_vlcustofin += Number(venda.vlcustofin);
    totais.total_qtcliente += Number(venda.qtcliente);
    totais.total_vlvendadodia += Number(venda.vlvendadodia);
    totais.total_vldevolucao += Number(venda.vldevolucao);
    totais.total_valor += Number(venda.valor_total);
  });
  
  // Calcular médias para os campos especificados
  totais.total_qtd_pedidos = vendasDiarias.reduce((sum, venda) => sum + Number(venda.qtd_pedidos), 0) / vendasDiarias.length;
  totais.total_media_itens = vendasDiarias.reduce((sum, venda) => sum + Number(venda.media_itens), 0) / vendasDiarias.length;
  totais.total_ticket_medio = vendasDiarias.reduce((sum, venda) => sum + Number(venda.ticket_medio), 0) / vendasDiarias.length;
  totais.total_via = vendasDiarias.reduce((sum, venda) => sum + Number(venda.via || 0), 0) / vendasDiarias.length;
  
  // Debug dos totais calculados
  debugValores('Totais calculados', totais);
  
  return totais;
}

// Função para verificar se a conexão Oracle está ativa e reconectar se necessário
async function verificarConexaoOracle(connection) {
  if (!connection) {
    console.log('Conexão Oracle não inicializada. Criando nova conexão...');
    return await criarConexaoOracle();
  }

  try {
    // Tentar executar uma consulta simples para verificar se a conexão está ativa
    await connection.execute('SELECT 1 FROM DUAL');
    return connection; // Conexão está ativa
  } catch (error) {
    console.log(`Conexão Oracle inativa ou com erro: ${error.message}. Reconectando...`);
    
    try {
      // Tentar fechar a conexão antiga se possível
      await connection.close();
    } catch (closeError) {
      // Ignorar erros ao fechar conexão inativa
    }
    
    // Criar nova conexão
    return await criarConexaoOracle();
  }
}

// Função para criar uma nova conexão Oracle
async function criarConexaoOracle() {
  try {
    const connection = await oracledb.getConnection({
      user: process.env.LCDBUSER,
      password: process.env.LCDBPASS,
      connectString: `${process.env.LCDBHOST}/${process.env.LCDBNAME}`
    });
    writeLog('Conectado ao Oracle DB.');
    console.log('Conectado ao Oracle DB.');
    return connection;
  } catch (dbError) {
    writeLog(`Erro ao conectar ao Oracle: ${dbError.message}`);
    console.error(`Erro ao conectar ao Oracle: ${dbError.message}`);
    throw dbError;
  }
}

// Função para obter as configurações de departamentos e seções do vendedor
async function getVendedorFiltros(token, vendedorId) {
  try {
    console.log(`Obtendo filtros para o vendedor ID: ${vendedorId}`);
    
    // Consultar departamentos configurados para o vendedor
    const queryDepartamentos = `
      SELECT vd.departamento_id, d.codpto 
      FROM vendedor_departamentos vd 
      JOIN departamentos d ON vd.departamento_id = d.id 
      WHERE vd.vendedor_id = ${vendedorId}`;
    
    const responseDepartamentos = await axios.post(`${process.env.API_URL}/executar_consulta.php`, 
      { query: queryDepartamentos },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    // Consultar seções configuradas para o vendedor
    const querySecoes = `
      SELECT vs.secao_id, s.codsec 
      FROM vendedor_secoes vs 
      JOIN secao s ON vs.secao_id = s.id 
      WHERE vs.vendedor_id = ${vendedorId}`;
    
    const responseSecoes = await axios.post(`${process.env.API_URL}/executar_consulta.php`, 
      { query: querySecoes },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    let departamentos = [];
    let secoes = [];
    
    if (responseDepartamentos.data && responseDepartamentos.data.success && responseDepartamentos.data.result) {
      departamentos = responseDepartamentos.data.result.map(item => parseInt(item.codpto));
    }
    
    if (responseSecoes.data && responseSecoes.data.success && responseSecoes.data.result) {
      secoes = responseSecoes.data.result.map(item => parseInt(item.codsec));
    }
    
    console.log(`Filtros obtidos para vendedor ${vendedorId}: ${departamentos.length} departamentos, ${secoes.length} seções`);
    
    return {
      departamentos: departamentos.length > 0 ? departamentos : null,
      secoes: secoes.length > 0 ? secoes : null
    };
  } catch (error) {
    console.error(`Erro ao obter filtros do vendedor: ${error.message}`);
    writeLog(`Erro ao obter filtros do vendedor ${vendedorId}: ${error.message}`);
    return { departamentos: null, secoes: null };
  }
}

// Função principal de sincronização
async function syncVendas() {
  let oracleConnection;
  const startTime = new Date();
  
  writeLog('Sincronização de vendas iniciada.');
  
  try {
    // Obter token de autenticação
    const token = await getAuthToken();
    writeLog('Token de autenticação obtido com sucesso.');
    console.log('Token obtido com sucesso');
    
    // Obter lista de vendedores
    const vendedores = await getVendedores(token);
    writeLog(`Obtidos ${vendedores.length} vendedores.`);
    console.log(`Obtidos ${vendedores.length} vendedores.`);
    
    // Calcular datas do mês atual (corrigindo para usar a data atual, não futura)
    const dataAtual = moment();
    const dataInicial = dataAtual.clone().startOf('month').format('YYYY-MM-DD');
    const dataFinal = dataAtual.clone().endOf('month').format('YYYY-MM-DD');
    console.log(`Período atual: ${dataInicial} a ${dataFinal}`);
    writeLog(`Período de sincronização: ${dataInicial} a ${dataFinal}`);
    
    // Conexão com o Oracle
    try {
      oracleConnection = await criarConexaoOracle();
    } catch (dbError) {
      writeLog(`Erro ao conectar ao Oracle: ${dbError.message}`);
      console.error(`Erro ao conectar ao Oracle: ${dbError.message}`);
      throw dbError;
    }
    
    // Estatísticas gerais de sincronização
    let totalVendedores = 0;
    let totalVendasDiarias = 0;
    let totalVendasDiariasCadastradas = 0;
    let totalVendasDiariasAtualizadas = 0;
    let totalVendasDiariasJaExistentes = 0;
    let totalVendasTotaisCadastradas = 0;
    let totalVendasTotaisAtualizadas = 0;
    let totalVendasTotaisJaExistentes = 0;
    
    // Para cada vendedor, obter e sincronizar dados
    for (const vendedor of vendedores) {
      if (!vendedor.rca || !vendedor.filial || !vendedor.filial.codigo) {
        writeLog(`Vendedor ${vendedor.nome} (ID: ${vendedor.id}) não possui RCA ou filial configurada. Pulando.`);
        console.log(`Pulando vendedor ${vendedor.nome}: RCA ou filial não configurada`);
        continue;
      }
      
      totalVendedores++;
      console.log(`Processando vendedor: ${vendedor.nome}, RCA: ${vendedor.rca}, Filial: ${vendedor.filial.codigo}`);
      
      try {
        // Obter filtros de departamentos e seções para o vendedor
        const filtros = await getVendedorFiltros(token, vendedor.id);
        
        // Verificar se a conexão está ativa antes de executar a consulta
        oracleConnection = await verificarConexaoOracle(oracleConnection);
        
        // Obter vendas diárias do Oracle
        const vendasDiarias = await getVendasDiarias(
          oracleConnection,
          dataInicial,
          dataFinal,
          vendedor.filial.codigo,
          vendedor.rca,
          filtros.departamentos,
          filtros.secoes
        );
        
        if (!vendasDiarias || vendasDiarias.length === 0) {
          writeLog(`Nenhuma venda encontrada para o vendedor ${vendedor.nome} (RCA: ${vendedor.rca}).`);
          console.log(`Nenhuma venda encontrada para o vendedor ${vendedor.nome}`);
          continue;
        }
        
        totalVendasDiarias += vendasDiarias.length;
        writeLog(`Obtidas ${vendasDiarias.length} vendas diárias para vendedor ${vendedor.nome} (RCA: ${vendedor.rca}).`);
        console.log(`Obtidas ${vendasDiarias.length} vendas diárias para vendedor ${vendedor.nome}`);
        
        // Cadastrar cada venda diária
        let vendasCadastradas = 0;
        let vendasAtualizadas = 0;
        let vendasJaExistentes = 0;
        
        for (const vendaDiaria of vendasDiarias) {
          try {
            const resultado = await cadastrarVendaDiaria(token, vendaDiaria);
            if (resultado.success) {
              if (resultado.updated) {
                vendasAtualizadas++;
                totalVendasDiariasAtualizadas++;
                writeLog(`Venda diária atualizada: data=${vendaDiaria.data}, vendedor=${vendaDiaria.codusur}, valor=${vendaDiaria.valor_total}`);
              } else {
                vendasCadastradas++;
                totalVendasDiariasCadastradas++;
                writeLog(`Venda diária cadastrada: data=${vendaDiaria.data}, vendedor=${vendaDiaria.codusur}, valor=${vendaDiaria.valor_total}`);
              }
            } else if (resultado.message === 'Registro já existe') {
              vendasJaExistentes++;
              totalVendasDiariasJaExistentes++;
              console.log(`Venda diária já existe: data=${vendaDiaria.data}, vendedor=${vendaDiaria.codusur}`);
            }
          } catch (vendaError) {
            writeLog(`Erro ao processar venda diária (${vendaDiaria.data}): ${vendaError.message}`);
            console.error(`Erro ao processar venda diária (${vendaDiaria.data}): ${vendaError.message}`);
          }
        }
        
        console.log(`Vendas diárias: cadastradas=${vendasCadastradas}, atualizadas=${vendasAtualizadas}, já existentes=${vendasJaExistentes}`);
        writeLog(`Vendedor ${vendedor.nome}: vendas diárias cadastradas=${vendasCadastradas}, atualizadas=${vendasAtualizadas}, já existentes=${vendasJaExistentes}`);
        
        // Calcular totais e cadastrar venda total
        if (vendasDiarias.length > 0) {
          const totais = calcularTotais(vendasDiarias);
          
          const vendaTotal = {
            codusur: vendedor.rca,
            nome: vendedor.nome,
            data_inicio: dataInicial,
            data_fim: dataFinal,
            ...totais
          };
          
          try {
            const resultadoTotal = await cadastrarVendaTotal(token, vendaTotal);
            if (resultadoTotal.success) {
              if (resultadoTotal.updated) {
                totalVendasTotaisAtualizadas++;
                writeLog(`Venda total atualizada para vendedor ${vendedor.nome} (RCA: ${vendedor.rca}). Período: ${dataInicial} a ${dataFinal}`);
                console.log(`Venda total atualizada para vendedor ${vendedor.nome}`);
              } else {
                totalVendasTotaisCadastradas++;
                writeLog(`Venda total cadastrada para vendedor ${vendedor.nome} (RCA: ${vendedor.rca}). Período: ${dataInicial} a ${dataFinal}`);
                console.log(`Venda total cadastrada para vendedor ${vendedor.nome}`);
              }
            } else if (resultadoTotal.message === 'Registro já existe') {
              totalVendasTotaisJaExistentes++;
              writeLog(`Venda total já existe para vendedor ${vendedor.nome} (RCA: ${vendedor.rca}). Período: ${dataInicial} a ${dataFinal}`);
              console.log(`Venda total já existe para vendedor ${vendedor.nome}`);
            } else {
              writeLog(`Venda total não processada: ${resultadoTotal.message}`);
              console.log(`Venda total não processada: ${resultadoTotal.message}`);
            }
          } catch (totalError) {
            writeLog(`Erro ao processar venda total: ${totalError.message}`);
            console.error(`Erro ao processar venda total: ${totalError.message}`);
          }
        }
      } catch (error) {
        writeLog(`Erro ao processar vendedor ${vendedor.nome} (RCA: ${vendedor.rca}): ${error.message}`);
        console.error(`Erro ao processar vendedor ${vendedor.nome}: ${error.message}`);
      }
    }
    
    // Resumo final
    writeLog('=== RESUMO DA SINCRONIZAÇÃO ===');
    writeLog(`Vendedores processados: ${totalVendedores}`);
    writeLog(`Vendas diárias encontradas: ${totalVendasDiarias}`);
    writeLog(`Vendas diárias cadastradas: ${totalVendasDiariasCadastradas}`);
    writeLog(`Vendas diárias atualizadas: ${totalVendasDiariasAtualizadas}`);
    writeLog(`Vendas diárias já existentes: ${totalVendasDiariasJaExistentes}`);
    writeLog(`Vendas totais cadastradas: ${totalVendasTotaisCadastradas}`);
    writeLog(`Vendas totais atualizadas: ${totalVendasTotaisAtualizadas}`);
    writeLog(`Vendas totais já existentes: ${totalVendasTotaisJaExistentes}`);
    writeLog('==============================');
    
    console.log('=== RESUMO DA SINCRONIZAÇÃO ===');
    console.log(`Vendedores processados: ${totalVendedores}`);
    console.log(`Vendas diárias encontradas: ${totalVendasDiarias}`);
    console.log(`Vendas diárias cadastradas: ${totalVendasDiariasCadastradas}`);
    console.log(`Vendas diárias atualizadas: ${totalVendasDiariasAtualizadas}`);
    console.log(`Vendas diárias já existentes: ${totalVendasDiariasJaExistentes}`);
    console.log(`Vendas totais cadastradas: ${totalVendasTotaisCadastradas}`);
    console.log(`Vendas totais atualizadas: ${totalVendasTotaisAtualizadas}`);
    console.log(`Vendas totais já existentes: ${totalVendasTotaisJaExistentes}`);
    console.log('==============================');
    
    writeLog('Sincronização de vendas concluída com sucesso.');
    console.log('Sincronização de vendas concluída com sucesso.');
  } catch (err) {
    writeLog(`Erro durante o processo de sincronização de vendas: ${err.message}`);
    console.error(`Erro geral: ${err.message}`);
  } finally {
    // Fechar conexão
    if (oracleConnection) {
      try {
        await oracleConnection.close();
        writeLog('Conexão com o Oracle fechada.');
        console.log('Conexão com o Oracle fechada.');
      } catch (closeError) {
        writeLog(`Erro ao fechar conexão: ${closeError.message}`);
        console.error(`Erro ao fechar conexão: ${closeError.message}`);
      }
    }
    
    const endTime = new Date();
    const duracao = (endTime - startTime) / 1000;
    writeLog(`Sincronização finalizada. Duração: ${duracao}s.`);
    console.log(`Sincronização finalizada. Duração: ${duracao}s.`);
  }
}

// Função para obter departamentos do Oracle
async function getDepartamentos(connection) {
  try {
    console.log('Consultando departamentos no Oracle...');
    
    // Configurar o formato de saída para datas no Oracle
    await connection.execute(`ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD'`);
    
    const result = await connection.execute(
      `SELECT PCDEPTO.ROWID RID
       , PCDEPTO.ATUALIZAINVGERAL 
       , PCDEPTO.CODEPTO 
       , PCDEPTO.DESCRICAO 
       , PCDEPTO.MARGEMPREVISTA 
       , PCDEPTO.REFERENCIA 
       , PCDEPTO.TIPOMERC 
    FROM PCDEPTO
    WHERE 1=1`
    );
    
    if (!result.rows || result.rows.length === 0) {
      console.log('Nenhum departamento encontrado na consulta Oracle');
      return [];
    }
    
    console.log(`Encontrados ${result.rows.length} departamentos`);
    
    return result.rows.map(row => {
      return {
        rid: row.RID,
        atualizainvgeral: row.ATUALIZAINVGERAL || 'N',
        codpto: row.CODEPTO,
        descricao: row.DESCRICAO,
        margemprevista: parseFloat(row.MARGEMPREVISTA || 0),
        referencia: row.REFERENCIA || '',
        tipomerc: row.TIPOMERC || ''
      };
    });
  } catch (error) {
    writeLog(`Erro ao obter departamentos: ${error.message}`);
    console.error(`Erro na consulta de departamentos: ${error.message}`);
    throw error;
  }
}

// Função para obter seções do Oracle
async function getSecoes(connection) {
  try {
    console.log('Consultando seções no Oracle...');
    
    // Configurar o formato de saída para datas no Oracle
    await connection.execute(`ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD'`);
    
    const result = await connection.execute(
      `SELECT PCSECAO.ROWID RID
       , PCSECAO.CODEPTO 
       , J1.DESCRICAO J1_DESCRICAO
       , PCSECAO.CODSEC 
       , PCSECAO.DESCRICAO 
       , PCSECAO.LINHA 
       , PCSECAO.QTMAX 
       , PCSECAO.TIPO 
    FROM PCSECAO
      , PCDEPTO J1
    WHERE (1=1
     and (PCSECAO.CODEPTO = J1.CODEPTO(+))) AND NOT (PCSECAO.DTEXCLUSAO IS NOT NULL)`
    );
    
    if (!result.rows || result.rows.length === 0) {
      console.log('Nenhuma seção encontrada na consulta Oracle');
      return [];
    }
    
    console.log(`Encontradas ${result.rows.length} seções`);
    
    return result.rows.map(row => {
      return {
        rid: row.RID,
        codpto: row.CODEPTO,
        j1_descricao: row.J1_DESCRICAO,
        codsec: row.CODSEC,
        descricao: row.DESCRICAO,
        linha: row.LINHA || '',
        qtmax: row.QTMAX || null,
        tipo: row.TIPO || ''
      };
    });
  } catch (error) {
    writeLog(`Erro ao obter seções: ${error.message}`);
    console.error(`Erro na consulta de seções: ${error.message}`);
    throw error;
  }
}

// Função para cadastrar ou atualizar departamento na API
async function cadastrarDepartamento(token, departamento) {
  try {
    // Verificar se o departamento já existe
    const response = await axios.get(`${process.env.API_URL}/listar_departamentos.php?codpto=${departamento.codpto}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.success && response.data.departamentos && response.data.departamentos.length > 0) {
      // Departamento já existe, atualizar
      const deptExistente = response.data.departamentos[0];
      console.log(`Atualizando departamento: ${departamento.descricao} (ID: ${deptExistente.id})`);
      
      const updateData = {
        id: deptExistente.id,
        rid: departamento.rid,
        atualizainvgeral: departamento.atualizainvgeral,
        codpto: departamento.codpto,
        descricao: departamento.descricao,
        margemprevista: departamento.margemprevista,
        referencia: departamento.referencia,
        tipomerc: departamento.tipomerc
      };
      
      const updateResponse = await axios.post(`${process.env.API_URL}/atualizar_departamento.php`, updateData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (updateResponse.data && updateResponse.data.success) {
        return { success: true, message: 'Departamento atualizado com sucesso', updated: true };
      } else {
        throw new Error(`Falha ao atualizar departamento: ${updateResponse.data ? updateResponse.data.message : 'Resposta inválida'}`);
      }
    } else {
      // Departamento não existe, cadastrar novo
      console.log(`Cadastrando novo departamento: ${departamento.descricao}`);
      
      const createResponse = await axios.post(`${process.env.API_URL}/cadastrar_departamento.php`, departamento, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (createResponse.data && createResponse.data.success) {
        return { success: true, message: 'Departamento cadastrado com sucesso', updated: false };
      } else {
        throw new Error(`Falha ao cadastrar departamento: ${createResponse.data ? createResponse.data.message : 'Resposta inválida'}`);
      }
    }
  } catch (error) {
    writeLog(`Erro ao processar departamento: ${error.message}`);
    console.error(`Erro ao processar departamento: ${error.message}`);
    throw error;
  }
}

// Função para cadastrar ou atualizar seção na API
async function cadastrarSecao(token, secao) {
  try {
    // Verificar se o departamento existe
    const deptoResponse = await axios.get(`${process.env.API_URL}/listar_departamentos.php?codpto=${secao.codpto}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!deptoResponse.data || !deptoResponse.data.success || !deptoResponse.data.departamentos || deptoResponse.data.departamentos.length === 0) {
      // Se o departamento não existe, continuar com codpto=0
      console.log(`Departamento ${secao.codpto} não encontrado para seção ${secao.descricao} (${secao.codsec}). Cadastrando com codpto=0`);
      writeLog(`Departamento ${secao.codpto} não encontrado para seção ${secao.descricao} (${secao.codsec}). Cadastrando com codpto=0`);
      secao.codpto = 0;
    }
    
    // Verificar se a seção já existe
    const response = await axios.get(`${process.env.API_URL}/listar_secoes.php?codsec=${secao.codsec}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.success && response.data.secoes && response.data.secoes.length > 0) {
      // Seção já existe, atualizar
      const secaoExistente = response.data.secoes[0];
      console.log(`Atualizando seção: ${secao.descricao} (ID: ${secaoExistente.id})`);
      
      // Garantir que todos os campos obrigatórios estejam presentes
      const updateData = {
        id: secaoExistente.id,
        rid: secao.rid || secaoExistente.rid,
        codpto: secao.codpto,
        codsec: secao.codsec,
        descricao: secao.descricao,
        linha: secao.linha || '',
        qtmax: secao.qtmax || null,
        tipo: secao.tipo || ''
      };
      
      // Remover caracteres especiais ou problemas de codificação
      Object.keys(updateData).forEach(key => {
        if (typeof updateData[key] === 'string') {
          updateData[key] = updateData[key].trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        }
      });
      
      try {
        const updateResponse = await axios.post(`${process.env.API_URL}/atualizar_secao.php`, updateData, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (updateResponse.data && updateResponse.data.success) {
          return { success: true, message: 'Seção atualizada com sucesso', updated: true };
        } else {
          throw new Error(`Falha ao atualizar seção: ${updateResponse.data ? updateResponse.data.message : 'Resposta inválida'}`);
        }
      } catch (updateError) {
        // Registrar detalhes do erro para diagnóstico
        console.error(`Erro ao atualizar seção ${secao.descricao}: ${updateError.message}`);
        if (updateError.response) {
          console.error(`Status: ${updateError.response.status}`);
          console.error(`Dados: ${JSON.stringify(updateError.response.data)}`);
        }
        throw updateError;
      }
    } else {
      // Seção não existe, cadastrar nova
      console.log(`Cadastrando nova seção: ${secao.descricao}`);
      
      // Garantir que todos os campos obrigatórios estejam presentes
      const createData = {
        rid: secao.rid || '',
        codpto: secao.codpto,
        codsec: secao.codsec,
        descricao: secao.descricao,
        linha: secao.linha || '',
        qtmax: secao.qtmax || null,
        tipo: secao.tipo || ''
      };
      
      // Remover caracteres especiais ou problemas de codificação
      Object.keys(createData).forEach(key => {
        if (typeof createData[key] === 'string') {
          createData[key] = createData[key].trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        }
      });
      
      try {
        const createResponse = await axios.post(`${process.env.API_URL}/cadastrar_secao.php`, createData, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (createResponse.data && createResponse.data.success) {
          return { success: true, message: 'Seção cadastrada com sucesso', updated: false };
        } else {
          throw new Error(`Falha ao cadastrar seção: ${createResponse.data ? createResponse.data.message : 'Resposta inválida'}`);
        }
      } catch (createError) {
        // Registrar detalhes do erro para diagnóstico
        console.error(`Erro ao cadastrar seção ${secao.descricao}: ${createError.message}`);
        if (createError.response) {
          console.error(`Status: ${createError.response.status}`);
          console.error(`Dados: ${JSON.stringify(createError.response.data)}`);
        }
        throw createError;
      }
    }
  } catch (error) {
    writeLog(`Erro ao processar seção ${secao.descricao}: ${error.message}`);
    console.error(`Erro ao processar seção ${secao.descricao}: ${error.message}`);
    throw error;
  }
}

// Função para sincronizar departamentos e seções
async function syncDepartamentosSecoes() {
  let oracleConnection;
  const startTime = new Date();
  
  writeLog('Sincronização de departamentos e seções iniciada.');
  
  try {
    // Obter token de autenticação
    const token = await getAuthToken();
    writeLog('Token de autenticação obtido com sucesso.');
    console.log('Token obtido com sucesso');
    
    // Conexão com o Oracle
    try {
      oracleConnection = await criarConexaoOracle();
    } catch (dbError) {
      writeLog(`Erro ao conectar ao Oracle: ${dbError.message}`);
      console.error(`Erro ao conectar ao Oracle: ${dbError.message}`);
      throw dbError;
    }
    
    // Sincronizar departamentos
    try {
      const departamentos = await getDepartamentos(oracleConnection);
      writeLog(`Obtidos ${departamentos.length} departamentos.`);
      console.log(`Obtidos ${departamentos.length} departamentos.`);
      
      let deptCadastrados = 0;
      let deptAtualizados = 0;
      
      for (const departamento of departamentos) {
        try {
          const resultado = await cadastrarDepartamento(token, departamento);
          if (resultado.success) {
            if (resultado.updated) {
              deptAtualizados++;
              writeLog(`Departamento atualizado: ${departamento.descricao} (${departamento.codpto})`);
            } else {
              deptCadastrados++;
              writeLog(`Departamento cadastrado: ${departamento.descricao} (${departamento.codpto})`);
            }
          }
        } catch (error) {
          writeLog(`Erro ao processar departamento ${departamento.descricao}: ${error.message}`);
          console.error(`Erro ao processar departamento ${departamento.descricao}: ${error.message}`);
        }
      }
      
      console.log(`Departamentos: cadastrados=${deptCadastrados}, atualizados=${deptAtualizados}`);
      writeLog(`Departamentos: cadastrados=${deptCadastrados}, atualizados=${deptAtualizados}`);
    } catch (error) {
      writeLog(`Erro ao sincronizar departamentos: ${error.message}`);
      console.error(`Erro ao sincronizar departamentos: ${error.message}`);
    }
    
    // Sincronizar seções
    try {
      const secoes = await getSecoes(oracleConnection);
      writeLog(`Obtidas ${secoes.length} seções.`);
      console.log(`Obtidas ${secoes.length} seções.`);
      
      let secoesCadastradas = 0;
      let secoesAtualizadas = 0;
      
      for (const secao of secoes) {
        try {
          const resultado = await cadastrarSecao(token, secao);
          if (resultado.success) {
            if (resultado.updated) {
              secoesAtualizadas++;
              writeLog(`Seção atualizada: ${secao.descricao} (${secao.codsec})`);
            } else {
              secoesCadastradas++;
              writeLog(`Seção cadastrada: ${secao.descricao} (${secao.codsec})`);
            }
          }
        } catch (error) {
          writeLog(`Erro ao processar seção ${secao.descricao}: ${error.message}`);
          console.error(`Erro ao processar seção ${secao.descricao}: ${error.message}`);
        }
      }
      
      console.log(`Seções: cadastradas=${secoesCadastradas}, atualizadas=${secoesAtualizadas}`);
      writeLog(`Seções: cadastradas=${secoesCadastradas}, atualizadas=${secoesAtualizadas}`);
    } catch (error) {
      writeLog(`Erro ao sincronizar seções: ${error.message}`);
      console.error(`Erro ao sincronizar seções: ${error.message}`);
    }
    
    writeLog('Sincronização de departamentos e seções concluída com sucesso.');
    console.log('Sincronização de departamentos e seções concluída com sucesso.');
  } catch (err) {
    writeLog(`Erro durante o processo de sincronização de departamentos e seções: ${err.message}`);
    console.error(`Erro geral: ${err.message}`);
  } finally {
    // Fechar conexão
    if (oracleConnection) {
      try {
        await oracleConnection.close();
        writeLog('Conexão com o Oracle fechada.');
        console.log('Conexão com o Oracle fechada.');
      } catch (closeError) {
        writeLog(`Erro ao fechar conexão: ${closeError.message}`);
        console.error(`Erro ao fechar conexão: ${closeError.message}`);
      }
    }
    
    const endTime = new Date();
    const duracao = (endTime - startTime) / 1000;
    writeLog(`Sincronização de departamentos e seções finalizada. Duração: ${duracao}s.`);
    console.log(`Sincronização de departamentos e seções finalizada. Duração: ${duracao}s.`);
  }
}

// Agendar sincronização a cada 5 minutos
schedule.scheduleJob('*/5 * * * *', () => {
  console.log(`Sincronização de vendas iniciada em: ${new Date().toLocaleString()}`);
  syncVendas();
});

// Agendar sincronização de departamentos e seções diariamente às 01:00
schedule.scheduleJob('0 1 * * *', () => {
  console.log(`Sincronização de departamentos e seções iniciada em: ${new Date().toLocaleString()}`);
  syncDepartamentosSecoes();
});

// Executar sincronização imediatamente ao iniciar
syncVendas();
syncDepartamentosSecoes();

console.log('Sincronização de vendas agendada a cada 5 minutos.');
console.log('Sincronização de departamentos e seções agendada diariamente às 01:00.'); 