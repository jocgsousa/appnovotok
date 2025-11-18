const dotenv = require('dotenv');
// Força que valores definidos no .env sobrescrevam variáveis já existentes,
// e que definições duplicadas no arquivo respeitem a última ocorrência (ex: bloco Local).
dotenv.config({ override: true });
const fs = require('fs');
const path = require('path');
const oracledb = require('oracledb');
const axios = require('axios');
const schedule = require('node-schedule');
const moment = require('moment');
const mysql = require('mysql2/promise');

// Configuração do Oracle Instant Client
const oracleClientPath = path.resolve(__dirname, 'instantclient_19_25');
oracledb.initOracleClient({ libDir: oracleClientPath });

// Configurações adicionais do Oracle
oracledb.fetchAsString = [oracledb.DATE];
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
// Log de configuração de MySQL em uso
console.log(`MySQL alvo: host=${process.env.EXDBHOST} db=${process.env.EXDBNAME} user=${process.env.EXDBUSER}`);
writeLog(`MySQL alvo: host=${process.env.EXDBHOST} db=${process.env.EXDBNAME} user=${process.env.EXDBUSER}`);

// ===============================
// Conexão e utilitários MySQL (Bijou Filial)
// ===============================
async function criarConexaoMySQL() {
  const conn = await mysql.createConnection({
    host: process.env.EXDBHOST,
    user: process.env.EXDBUSER,
    password: process.env.EXDBPASS,
    database: process.env.EXDBNAME,
    multipleStatements: false
  });
  return conn;
}

async function listarFiliaisMySQL(mysqlConn) {
  const [rows] = await mysqlConn.execute('SELECT id, codigo FROM filiais');
  return rows.map(r => ({ id: r.id, codigo: normalizeCodigoFilial(r.codigo) }));
}

// Listar configuração Bijou/Make/Bolsas por filial no MySQL
async function listarBijouConfigMySQL(mysqlConn) {
  const [rows] = await mysqlConn.execute(`
    SELECT c.filial_id, f.codigo, c.departamentos, c.secoes, c.ativo
    FROM bijou_filial_config c
    JOIN filiais f ON f.id = c.filial_id
    WHERE c.ativo = 1
  `);
  return rows.map(r => ({
    filial_id: r.filial_id,
    codigo: normalizeCodigoFilial(r.codigo),
    departamentosCSV: (r.departamentos || '').trim() || null,
    secoesCSV: (r.secoes || '').trim() || null,
  }));
}

// Buscar configuração ativa por código da filial
async function getBijouConfigForFilial(mysqlConn, filialCodigoNorm) {
  const [rows] = await mysqlConn.execute(
    `SELECT c.filial_id, f.codigo, c.departamentos, c.secoes, c.ativo
     FROM bijou_filial_config c
     JOIN filiais f ON f.id = c.filial_id
     WHERE c.ativo = 1 AND f.codigo = ?`
  , [filialCodigoNorm]);
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    filial_id: r.filial_id,
    codigo: normalizeCodigoFilial(r.codigo),
    departamentosCSV: (r.departamentos || '').trim() || null,
    secoesCSV: (r.secoes || '').trim() || null,
  };
}

function csvFromArray(arr) {
  return (arr || []).filter(Boolean).map(String).join(',');
}

// Converte uma string CSV em um array de inteiros
function parseCSVToIntArray(csv) {
  if (!csv || typeof csv !== 'string') return null;
  const parts = csv
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const nums = parts
    .map(p => parseInt(p, 10))
    .filter(n => !Number.isNaN(n));
  return nums.length > 0 ? nums : null;
}

function firstAndLastDayOfMonth(year, month) {
  const first = new Date(year, month - 1, 1);
  // Ensure last day includes end-of-day time to cover all movements
  const last = new Date(year, month, 0, 23, 59, 59, 999);
  return { first, last };
}

// Normaliza código de filial para evitar divergências (zeros à esquerda, espaços)
function normalizeCodigoFilial(code) {
  const raw = String(code ?? '').trim();
  const noLeading = raw.replace(/^0+/, '');
  return noLeading === '' ? '0' : noLeading;
}

// ===============================
// Consulta Oracle Totais Bijou/Make/Bolsas por Filial
// ===============================
async function consultarTotaisBijouPorFilial(oracleConnection, params) {
  const { dtIni, dtFim, filiaisCSV, deptosCSV, secoesCSV } = params;

  const sql = `
    WITH Vendas AS (
      SELECT
        PCNFSAID.CODFILIAL AS CODFILIAL,
        SUM(
          ROUND(
            DECODE(PCMOV.CODOPER,
              'S', NVL(DECODE(PCNFSAID.CONDVENDA, 7, PCMOV.QTCONT, PCMOV.QT), 0),
              'ST', NVL(DECODE(PCNFSAID.CONDVENDA, 7, PCMOV.QTCONT, PCMOV.QT), 0),
              'SM', NVL(DECODE(PCNFSAID.CONDVENDA, 7, PCMOV.QTCONT, PCMOV.QT), 0),
              'SB', NVL(DECODE(PCNFSAID.CONDVENDA, 7, PCMOV.QTCONT, PCMOV.QT), 0),
              0
            ) * NVL(
              DECODE(PCNFSAID.CONDVENDA,
                7, NVL(PCMOV.PUNITCONT, 0),
                NVL(PCMOV.PUNIT, 0) + NVL(PCMOV.VLFRETE, 0) + NVL(PCMOV.VLOUTRASDESP, 0) + NVL(PCMOV.VLFRETE_RATEIO, 0)
              ), 0
            ), 2
          )
          + ROUND(
            NVL(PCMOV.QT, 0) * DECODE(PCNFSAID.CONDVENDA, 5, 0, 6, 0, 11, 0, 12, 0,
              DECODE(PCMOV.CODOPER, 'SB', 0, NVL(PCMOV.VLIPI, 0))
            ), 2
          )
          + ROUND(
            NVL(PCMOV.QT, 0) * DECODE(PCNFSAID.CONDVENDA, 5, 0, 6, 0, 11, 0, 12, 0,
              DECODE(PCMOV.CODOPER, 'SB', 0, (NVL(PCMOV.ST, 0) + NVL(PCMOVCOMPLE.VLSTTRANSFCD, 0)))
            ), 2
          )
        ) AS VLTOTAL
      FROM PCNFSAID
      JOIN PCMOV ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA AND PCMOV.CODFILIAL = PCNFSAID.CODFILIAL
      JOIN PCPRODUT ON PCMOV.CODPROD = PCPRODUT.CODPROD
      LEFT JOIN PCMOVCOMPLE ON PCMOV.NUMTRANSITEM = PCMOVCOMPLE.NUMTRANSITEM
      WHERE PCMOV.DTMOV BETWEEN :dtIni AND :dtFim
        -- Importante: não filtrar por DTSAIDA aqui para evitar excluir movimentos válidos
        AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
        AND PCMOV.CODOPER <> 'SR'
        AND PCMOV.CODOPER <> 'SO'
        AND PCNFSAID.CODFISCAL NOT IN (522, 622, 722, 532, 632, 732)
        AND PCNFSAID.CONDVENDA NOT IN (4, 8, 10, 13, 20, 98, 99)
        AND PCNFSAID.DTCANCEL IS NULL
        AND TO_NUMBER(PCNFSAID.CODFILIAL) IN (
          SELECT TO_NUMBER(REGEXP_SUBSTR(:filiaisCSV, '[^,]+', 1, LEVEL))
          FROM DUAL
          CONNECT BY REGEXP_SUBSTR(:filiaisCSV, '[^,]+', 1, LEVEL) IS NOT NULL
        )
        AND (
          :deptosCSV IS NULL OR PCPRODUT.CODEPTO IN (
            SELECT REGEXP_SUBSTR(:deptosCSV, '[^,]+', 1, LEVEL)
            FROM DUAL
            CONNECT BY REGEXP_SUBSTR(:deptosCSV, '[^,]+', 1, LEVEL) IS NOT NULL
          )
        )
        AND (
          :secoesCSV IS NULL OR PCPRODUT.CODSEC IN (
            SELECT REGEXP_SUBSTR(:secoesCSV, '[^,]+', 1, LEVEL)
            FROM DUAL
            CONNECT BY REGEXP_SUBSTR(:secoesCSV, '[^,]+', 1, LEVEL) IS NOT NULL
          )
        )
      GROUP BY PCNFSAID.CODFILIAL
    ),
    Devolucoes AS (
      SELECT
        NVL(PCNFENT.CODFILIALNF, PCNFENT.CODFILIAL) AS CODFILIAL,
        SUM(DECODE(PCNFENT.VLTOTAL, 0, PCESTCOM.VLDEVOLUCAO, PCNFENT.VLTOTAL) - NVL(PCNFENT.VLOUTRAS, 0) - NVL(PCNFENT.VLFRETE, 0)) AS VLTOTAL
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
      WHERE TO_NUMBER(NVL(PCNFENT.CODFILIALNF, PCNFENT.CODFILIAL)) IN (
        SELECT TO_NUMBER(REGEXP_SUBSTR(:filiaisCSV, '[^,]+', 1, LEVEL))
        FROM DUAL
        CONNECT BY REGEXP_SUBSTR(:filiaisCSV, '[^,]+', 1, LEVEL) IS NOT NULL
      )
        AND PCNFENT.DTENT BETWEEN :dtIni AND :dtFim
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
            AND TO_NUMBER(NVL(PCNFENT.CODFILIALNF, PCNFENT.CODFILIAL)) IN (
              SELECT TO_NUMBER(REGEXP_SUBSTR(:filiaisCSV, '[^,]+', 1, LEVEL))
              FROM DUAL
              CONNECT BY REGEXP_SUBSTR(:filiaisCSV, '[^,]+', 1, LEVEL) IS NOT NULL
            )
            AND PCNFENT.CODDEVOL = 31
            AND PCMOV.CODFILIAL = PCNFENT.CODFILIAL
            AND (
              :deptosCSV IS NULL OR PCDEPTO.CODEPTO IN (
                SELECT REGEXP_SUBSTR(:deptosCSV, '[^,]+', 1, LEVEL)
                FROM DUAL
                CONNECT BY REGEXP_SUBSTR(:deptosCSV, '[^,]+', 1, LEVEL) IS NOT NULL
              )
            )
            AND (
              :secoesCSV IS NULL OR PCSECAO.CODSEC IN (
                SELECT REGEXP_SUBSTR(:secoesCSV, '[^,]+', 1, LEVEL)
                FROM DUAL
                CONNECT BY REGEXP_SUBSTR(:secoesCSV, '[^,]+', 1, LEVEL) IS NOT NULL
              )
            )
        )
        AND NVL(PCNFSAID.CONDVENDA, 0) NOT IN (4, 8, 10, 13, 20, 98, 99)
        AND PCNFENT.CODDEVOL = 31
      GROUP BY NVL(PCNFENT.CODFILIALNF, PCNFENT.CODFILIAL)
    )
    SELECT V.CODFILIAL,
           NVL(V.VLTOTAL, 0) - NVL(D.VLTOTAL, 0) AS VLTOTAL
      FROM Vendas V
      LEFT JOIN Devolucoes D ON D.CODFILIAL = V.CODFILIAL
  `;

  const binds = {
    dtIni,
    dtFim,
    filiaisCSV,
    deptosCSV: deptosCSV || null,
    secoesCSV: secoesCSV || null
  };

  const result = await oracleConnection.execute(sql, binds);
  const rows = result.rows || [];
  return rows.map(r => ({ codfilial: normalizeCodigoFilial(r.CODFILIAL), valor_total: toNumberSafe(r.VLTOTAL) }));
}

async function upsertTotaisBijouFilial(mysqlConn, totals, periodo, config) {
  const { mes, ano, data_inicio, data_fim } = periodo;
  const { departamentosCSV, secoesCSV } = config;
  const configKey = `deptos=${departamentosCSV || ''}|secoes=${secoesCSV || ''}`;

  const [filiaisRows] = await mysqlConn.execute('SELECT id, codigo FROM filiais');
  const filialIdByCodigo = new Map(filiaisRows.map(r => [normalizeCodigoFilial(r.codigo), r.id]));

  const insertSQL = `
    INSERT INTO bijou_filial_totais
      (filial_id, codfilial, mes, ano, data_inicio, data_fim, valor_total, config_key, departamentos, secoes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      valor_total = VALUES(valor_total),
      data_inicio = VALUES(data_inicio),
      data_fim = VALUES(data_fim),
      updated_at = CURRENT_TIMESTAMP
  `;

  for (const t of totals) {
    const codfilialNorm = normalizeCodigoFilial(t.codfilial);
    const filial_id = filialIdByCodigo.get(codfilialNorm) || null;
    if (!filial_id) {
      console.warn(`[BijouFilial] Aviso: codfilial ${codfilialNorm} não encontrado em filiais. Pulando upsert.`);
      continue;
    }
    await mysqlConn.execute(insertSQL, [
      filial_id,
      codfilialNorm,
      mes,
      ano,
      moment(data_inicio).format('YYYY-MM-DD'),
      moment(data_fim).format('YYYY-MM-DD'),
      toNumberSafe(t.valor_total),
      configKey,
      departamentosCSV || null,
      secoesCSV || null
    ]);
  }
}

// Modo de teste: sincronizar Bijou apenas para uma filial específica
async function runBijouTest(filialCodigoInput, dtIniOverride = null, dtFimOverride = null) {
  const filialCodigoNorm = normalizeCodigoFilial(filialCodigoInput);
  console.log(`[BijouFilial][TESTE] Iniciando teste para filial código=${filialCodigoNorm}`);
  let oracleConnection;
  let mysqlConnection;
  try {
    oracleConnection = await oracledb.getConnection({
      user: process.env.LCDBUSER,
      password: process.env.LCDBPASS,
      connectString: `${process.env.LCDBHOST}/${process.env.LCDBNAME}`
    });
    mysqlConnection = await criarConexaoMySQL();
    await ensureBijouTablesExist(mysqlConnection);

    let config = null;
    try {
      config = await getBijouConfigForFilial(mysqlConnection, filialCodigoNorm);
    } catch (e) {
      console.warn('[BijouFilial][TESTE] Falha ao consultar configuração MySQL, usando fallback .env:', e && e.message ? e.message : e);
      config = null;
    }
    if (!config) {
      console.error('[BijouFilial][TESTE] Configuração ativa não encontrada no banco para a filial informada. Abortando teste.');
      return;
    }
    const departamentosCSV = config.departamentosCSV;
    const secoesCSV = config.secoesCSV;
    console.log(`[BijouFilial][TESTE] Configuração ativa encontrada: deptos=${departamentosCSV || '(todos)'} secoes=${secoesCSV || '(todas)'}`);

    const filiaisCSV = filialCodigoNorm;
    if (dtIniOverride && dtFimOverride) {
      const dtIni = moment(dtIniOverride, 'DD/MM/YYYY').startOf('day').toDate();
      const dtFim = moment(dtFimOverride, 'DD/MM/YYYY').endOf('day').toDate();
      const mes = moment(dtIniOverride, 'DD/MM/YYYY').month() + 1;
      const ano = moment(dtIniOverride, 'DD/MM/YYYY').year();
      console.log(`[BijouFilial][TESTE] Consultando período específico ${moment(dtIni).format('DD/MM/YYYY')} a ${moment(dtFim).format('DD/MM/YYYY')} para filiais=${filiaisCSV} ...`);
      const totalsPeriodo = await consultarTotaisBijouPorFilial(oracleConnection, {
        dtIni,
        dtFim,
        filiaisCSV,
        deptosCSV: departamentosCSV,
        secoesCSV: secoesCSV
      });
      console.log(`[BijouFilial][TESTE] Totais período retornados: ${totalsPeriodo.length}`);
      await upsertTotaisBijouFilial(mysqlConnection, totalsPeriodo, {
        mes,
        ano,
        data_inicio: dtIni,
        data_fim: dtFim
      }, { departamentosCSV, secoesCSV });
      console.log('[BijouFilial][TESTE] Concluído inserção/atualização em bijou_filial_totais (período específico)');
    } else {
      const now = new Date();
      const mesAtual = now.getMonth() + 1;
      const anoAtual = now.getFullYear();
      const { first: dtInitAtual, last: dtFimAtual } = firstAndLastDayOfMonth(anoAtual, mesAtual);
      console.log(`[BijouFilial][TESTE] Consultando mês atual para filiais=${filiaisCSV} ...`);
      const totalsAtual = await consultarTotaisBijouPorFilial(oracleConnection, {
        dtIni: dtInitAtual,
        dtFim: dtFimAtual,
        filiaisCSV,
        deptosCSV: departamentosCSV,
        secoesCSV: secoesCSV
      });
      console.log(`[BijouFilial][TESTE] Totais mês atual retornados: ${totalsAtual.length}`);
      await upsertTotaisBijouFilial(mysqlConnection, totalsAtual, {
        mes: mesAtual,
        ano: anoAtual,
        data_inicio: dtInitAtual,
        data_fim: dtFimAtual
      }, { departamentosCSV, secoesCSV });

      const mesAnteriorDate = new Date(anoAtual, mesAtual - 2, 1);
      const mesAnterior = mesAnteriorDate.getMonth() + 1;
      const anoAnterior = mesAnteriorDate.getFullYear();
      const { first: dtInitAnterior, last: dtFimAnterior } = firstAndLastDayOfMonth(anoAnterior, mesAnterior);
      console.log(`[BijouFilial][TESTE] Consultando mês anterior para filiais=${filiaisCSV} ...`);
      const totalsAnterior = await consultarTotaisBijouPorFilial(oracleConnection, {
        dtIni: dtInitAnterior,
        dtFim: dtFimAnterior,
        filiaisCSV,
        deptosCSV: departamentosCSV,
        secoesCSV: secoesCSV
      });
      console.log(`[BijouFilial][TESTE] Totais mês anterior retornados: ${totalsAnterior.length}`);
      await upsertTotaisBijouFilial(mysqlConnection, totalsAnterior, {
        mes: mesAnterior,
        ano: anoAnterior,
        data_inicio: dtInitAnterior,
        data_fim: dtFimAnterior
      }, { departamentosCSV, secoesCSV });
      console.log('[BijouFilial][TESTE] Concluído inserção/atualização em bijou_filial_totais');
    }
    // Mostrar últimos registros para a filial testada
    await logBijouTotalsForFilial(mysqlConnection, filialCodigoNorm);
  } catch (err) {
    console.error('[BijouFilial][TESTE] Erro no teste:', err && err.message ? err.message : err);
  } finally {
    try { if (oracleConnection) await oracleConnection.close(); } catch {}
    try { if (mysqlConnection) await mysqlConnection.end(); } catch {}
  }
}

async function syncBijouFilial() {
  let oracleConnection;
  let mysqlConnection;
  try {
    oracleConnection = await oracledb.getConnection({
      user: process.env.LCDBUSER,
      password: process.env.LCDBPASS,
      connectString: `${process.env.LCDBHOST}/${process.env.LCDBNAME}`
    });

    mysqlConnection = await criarConexaoMySQL();
    // Carregar configuração por filial; se não houver, usar env como fallback
    let configs = [];
    try {
      configs = await listarBijouConfigMySQL(mysqlConnection);
    } catch (e) {
      console.error('[BijouFilial] Falha ao listar configs MySQL:', e && e.message ? e.message : e);
      configs = [];
    }
    const hasConfigs = Array.isArray(configs) && configs.length > 0;

    if (!hasConfigs) {
      console.warn('[BijouFilial] Nenhuma configuração ativa encontrada no banco (bijou_filial_config). Sincronização de Bijou por filial não será executada.');
      return;
    }

    // Agrupar por par (departamentos,secoes) para consultar em lotes
    const groups = new Map();
    for (const cfg of configs) {
      const key = `deptos=${cfg.departamentosCSV || ''}|secoes=${cfg.secoesCSV || ''}`;
      if (!groups.has(key)) {
        groups.set(key, { departamentosCSV: cfg.departamentosCSV, secoesCSV: cfg.secoesCSV, filiais: [] });
      }
      // Quando vier de MySQL, cada cfg tem uma única filial (codigo)
      if (cfg.codigo) {
        groups.get(key).filiais.push(String(cfg.codigo));
      }
      // Fallback: uma configuração única para várias filiais
      if (cfg.filiaisCSV) {
        const list = String(cfg.filiaisCSV)
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
        groups.get(key).filiais.push(...list);
      }
    }

    console.log(`[BijouFilial] Total de grupos: ${groups.size}`);
    for (const [k, g] of groups.entries()) {
      console.log(`[BijouFilial] Grupo ${k} -> filiais: ${Array.from(new Set(g.filiais)).join(',') || '(nenhuma)'}`);
    }

    // Mês atual
    const now = new Date();
    const mesAtual = now.getMonth() + 1;
    const anoAtual = now.getFullYear();
    const { first: dtInitAtual, last: dtFimAtual } = firstAndLastDayOfMonth(anoAtual, mesAtual);
    // Para cada grupo, consultar e upsert para mês atual
    for (const group of groups.values()) {
      // Remover duplicidades e garantir que há filiais para consultar
      const filiaisList = Array.from(new Set(group.filiais.map(String))).filter(Boolean);
      if (filiaisList.length === 0) {
        console.warn('[BijouFilial] Grupo sem filiais, ignorando:', {
          departamentos: group.departamentosCSV,
          secoes: group.secoesCSV
        });
        continue;
      }
      const filiaisCSV = csvFromArray(filiaisList);
      console.log(`[BijouFilial] Consultando mês atual para filiais=${filiaisCSV} deptos=${group.departamentosCSV || '(todos)'} secoes=${group.secoesCSV || '(todas)'} ...`);
      const totalsAtual = await consultarTotaisBijouPorFilial(oracleConnection, {
        dtIni: dtInitAtual,
        dtFim: dtFimAtual,
        filiaisCSV,
        deptosCSV: group.departamentosCSV,
        secoesCSV: group.secoesCSV
      });
      console.log(`[BijouFilial] Totais mês atual retornados: ${totalsAtual.length}`);
      await upsertTotaisBijouFilial(mysqlConnection, totalsAtual, {
        mes: mesAtual,
        ano: anoAtual,
        data_inicio: dtInitAtual,
        data_fim: dtFimAtual
      }, { departamentosCSV: group.departamentosCSV, secoesCSV: group.secoesCSV });
    }

    // Mês anterior
    const mesAnteriorDate = new Date(anoAtual, mesAtual - 2, 1);
    const mesAnterior = mesAnteriorDate.getMonth() + 1;
    const anoAnterior = mesAnteriorDate.getFullYear();
    const { first: dtInitAnterior, last: dtFimAnterior } = firstAndLastDayOfMonth(anoAnterior, mesAnterior);
    for (const group of groups.values()) {
      const filiaisList = Array.from(new Set(group.filiais.map(String))).filter(Boolean);
      if (filiaisList.length === 0) {
        console.warn('[BijouFilial] Grupo sem filiais (mês anterior), ignorando:', {
          departamentos: group.departamentosCSV,
          secoes: group.secoesCSV
        });
        continue;
      }
      const filiaisCSV = csvFromArray(filiaisList);
      console.log(`[BijouFilial] Consultando mês anterior para filiais=${filiaisCSV} deptos=${group.departamentosCSV || '(todos)'} secoes=${group.secoesCSV || '(todas)'} ...`);
      const totalsAnterior = await consultarTotaisBijouPorFilial(oracleConnection, {
        dtIni: dtInitAnterior,
        dtFim: dtFimAnterior,
        filiaisCSV,
        deptosCSV: group.departamentosCSV,
        secoesCSV: group.secoesCSV
      });
      console.log(`[BijouFilial] Totais mês anterior retornados: ${totalsAnterior.length}`);
      await upsertTotaisBijouFilial(mysqlConnection, totalsAnterior, {
        mes: mesAnterior,
        ano: anoAnterior,
        data_inicio: dtInitAnterior,
        data_fim: dtFimAnterior
      }, { departamentosCSV: group.departamentosCSV, secoesCSV: group.secoesCSV });
    }

    console.log(`[BijouFilial] Totais sincronizados: atual (${mesAtual}/${anoAtual}) e anterior (${mesAnterior}/${anoAnterior}).`);
    writeLog(`[BijouFilial] Totais sincronizados: atual (${mesAtual}/${anoAtual}) e anterior (${mesAnterior}/${anoAnterior}).`);
  } catch (err) {
    console.error('[BijouFilial] Erro na sincronização:', err);
    writeLog(`[BijouFilial] Erro: ${err && err.message ? err.message : String(err)}`);
  } finally {
    try { if (oracleConnection) await oracleConnection.close(); } catch {}
    try { if (mysqlConnection) await mysqlConnection.end(); } catch {}
  }
}

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

// Busca vendedores por uma lista de RCAs diretamente via consulta SQL,
// retornando o mesmo formato utilizado por listar_vendedores.php
async function getVendedoresPorRCAs(token, rcasLista) {
  try {
    if (!Array.isArray(rcasLista) || rcasLista.length === 0) {
      return [];
    }
    const rcasCSV = rcasLista.map(r => `'${r}'`).join(',');
    const query = `SELECT v.id, v.rca, v.nome, v.email, v.filial_id, v.ativo, v.created_at, v.updated_at, f.codigo AS filial_codigo, f.nome_fantasia AS filial_nome
                   FROM vendedores v
                   LEFT JOIN filiais f ON v.filial_id = f.id
                   WHERE v.rca IN (${rcasCSV})`;
    const response = await axios.post(`${process.env.API_URL}/executar_consulta.php`, { query }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.data || !response.data.success) {
      throw new Error(response.data && response.data.message ? response.data.message : 'Falha ao consultar vendedores por RCA');
    }
    const result = Array.isArray(response.data.result) ? response.data.result : [];
    return result.map(r => ({
      id: Number(r.id),
      rca: r.rca,
      nome: r.nome,
      email: r.email,
      filial_id: r.filial_id ? Number(r.filial_id) : null,
      ativo: Boolean(r.ativo),
      created_at: r.created_at,
      updated_at: r.updated_at,
      filial: r.filial_id ? { id: Number(r.filial_id), nome: r.filial_nome, codigo: r.filial_codigo } : null
    }));
  } catch (error) {
    console.error(`Erro ao obter vendedores por RCAs: ${error.message}`);
    writeLog(`Erro ao obter vendedores por RCAs: ${error.message}`);
    return [];
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

// Função para obter totais mensais (VLVENDA e VLDEVOLUCAO) do Oracle por vendedor
async function getVendasTotaisOracle(connection, dataInicial, dataFinal, codFilial, codUsur, codDepartamento = null, codSecao = null) {
  try {
    const dataInicialOracle = moment(dataInicial).format('DD/MM/YYYY');
    const dataFinalOracle = moment(dataFinal).format('DD/MM/YYYY');

    await connection.execute(`ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD'`);
    await connection.execute(`ALTER SESSION SET NLS_NUMERIC_CHARACTERS = '.,'`);

    let sql = `WITH Vendas AS (
      SELECT
        PCNFSAID.CODUSUR AS CODUSUR,
        SUM(
          ROUND(
            DECODE(PCMOV.CODOPER,
              'S', NVL(DECODE(PCNFSAID.CONDVENDA, 7, PCMOV.QTCONT, PCMOV.QT), 0),
              'ST', NVL(DECODE(PCNFSAID.CONDVENDA, 7, PCMOV.QTCONT, PCMOV.QT), 0),
              'SM', NVL(DECODE(PCNFSAID.CONDVENDA, 7, PCMOV.QTCONT, PCMOV.QT), 0),
              'SB', NVL(DECODE(PCNFSAID.CONDVENDA, 7, PCMOV.QTCONT, PCMOV.QT), 0),
              0
            ) *
            NVL(
              DECODE(PCNFSAID.CONDVENDA,
                7, NVL(PCMOV.PUNITCONT, 0),
                NVL(PCMOV.PUNIT, 0) + NVL(PCMOV.VLFRETE, 0) + NVL(PCMOV.VLOUTRASDESP, 0) + NVL(PCMOV.VLFRETE_RATEIO, 0)
              ),
              0
            )
          , 2)
          + ROUND(
            NVL(PCMOV.QT, 0) * DECODE(PCNFSAID.CONDVENDA, 5, 0, 6, 0, 11, 0, 12, 0,
              DECODE(PCMOV.CODOPER, 'SB', 0, NVL(PCMOV.VLIPI, 0))
            )
          , 2)
          + ROUND(
            NVL(PCMOV.QT, 0) * DECODE(PCNFSAID.CONDVENDA, 5, 0, 6, 0, 11, 0, 12, 0,
              DECODE(PCMOV.CODOPER, 'SB', 0, (NVL(PCMOV.ST, 0) + NVL(PCMOVCOMPLE.VLSTTRANSFCD, 0)))
            )
          , 2)
        ) AS VLVENDA
      FROM PCNFSAID
      JOIN PCMOV ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA AND PCMOV.CODFILIAL = PCNFSAID.CODFILIAL
      JOIN PCPRODUT ON PCMOV.CODPROD = PCPRODUT.CODPROD
      LEFT JOIN PCMOVCOMPLE ON PCMOV.NUMTRANSITEM = PCMOVCOMPLE.NUMTRANSITEM
      WHERE PCMOV.DTMOV BETWEEN TO_DATE(:DATAI, 'DD/MM/YYYY') AND TO_DATE(:DATAF, 'DD/MM/YYYY')
        AND PCNFSAID.DTSAIDA BETWEEN TO_DATE(:DATAI, 'DD/MM/YYYY') AND TO_DATE(:DATAF, 'DD/MM/YYYY')
        AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
        AND PCMOV.CODOPER <> 'SR'
        AND PCMOV.CODOPER <> 'SO'
        AND PCNFSAID.CODFISCAL NOT IN (522, 622, 722, 532, 632, 732)
        AND PCNFSAID.CONDVENDA NOT IN (4, 8, 10, 13, 20, 98, 99)
        AND PCNFSAID.DTCANCEL IS NULL
        AND PCNFSAID.CODFILIAL = :CODFILIAL
        AND PCNFSAID.CODUSUR = :CODUSUR`;

    // Filtro de departamento na Vendas (adicionado dentro do WHERE)
    if (codDepartamento) {
      if (Array.isArray(codDepartamento)) {
        sql += ` AND (`;
        codDepartamento.forEach((dpto, index) => {
          if (index > 0) sql += ` OR `;
          sql += `PCPRODUT.CODEPTO = ${dpto}`;
        });
        sql += `)`;
      } else {
        sql += ` AND PCPRODUT.CODEPTO = ${codDepartamento}`;
      }
    }
    // Filtro de seção na Vendas (adicionado dentro do WHERE)
    if (codSecao) {
      if (Array.isArray(codSecao)) {
        sql += ` AND (`;
        codSecao.forEach((sec, index) => {
          if (index > 0) sql += ` OR `;
          sql += `PCPRODUT.CODSEC = ${sec}`;
        });
        sql += `)`;
      } else {
        sql += ` AND PCPRODUT.CODSEC = ${codSecao}`;
      }
    }

    // Finalizar Vendas com GROUP BY após inserir filtros
    sql += `
      GROUP BY PCNFSAID.CODUSUR
      ),
      Devolucoes AS (
        SELECT PCNFENT.CODUSURDEVOL AS CODUSUR,
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

    // Filtro de departamento na Devolucoes (EXISTS)
    if (codDepartamento) {
      if (Array.isArray(codDepartamento)) {
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
    // Filtro de seção na Devolucoes (EXISTS)
    if (codSecao) {
      if (Array.isArray(codSecao)) {
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
         GROUP BY PCNFENT.CODUSURDEVOL
      )
      SELECT
        NVL((SELECT VLVENDA FROM Vendas), 0) AS VLVENDA,
        NVL((SELECT VLDEVOLUCAO FROM Devolucoes), 0) AS VLDEVOLUCAO
      FROM DUAL`;

    const params = {
      DATAI: dataInicialOracle,
      DATAF: dataFinalOracle,
      CODFILIAL: codFilial,
      CODUSUR: codUsur
    };

    const result = await connection.execute(sql, params);
    const row = (result.rows && result.rows[0]) ? result.rows[0] : { VLVENDA: 0, VLDEVOLUCAO: 0 };

    return {
      vlvenda: toNumberSafe(row.VLVENDA),
      vldevolucao: toNumberSafe(row.VLDEVOLUCAO)
    };
  } catch (error) {
    writeLog(`Erro ao obter totais mensais Oracle: ${error.message}`);
    console.error(`Erro na consulta de totais mensais: ${error.message}`);
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
          // Aceitar tanto 'data_inicio'/'data_fim' quanto 'dataInicio'/'dataFim'
          const diRaw = venda.data_inicio || venda.dataInicio;
          const dfRaw = venda.data_fim || venda.dataFim;
          const codRaw = venda.codusur || venda.codUsuario;

          const normalizaData = (d) => {
            if (!d) return null;
            if (typeof d !== 'string') d = String(d);
            const s = d.trim();
            // DD/MM/YYYY -> YYYY-MM-DD
            if (s.includes('/')) {
              const [dd, mm, yyyy] = s.split('/');
              return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
            }
            // Já em YYYY-MM-DD ou com time, manter cabeçalho
            if (s.includes('-')) {
              return s.slice(0, 10);
            }
            return null;
          };

          const di = normalizaData(diRaw);
          const df = normalizaData(dfRaw);
          return di === dataInicio && df === dataFim && String(codRaw) === String(codusur);
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

        // Normalizar código de filial (evitar divergência com zeros à esquerda)
        const codFilialNorm = normalizeCodigoFilial(vendedor.filial.codigo);

        // Consolidar mês anterior para todos vendedores (independente de diárias do mês atual)
        try {
          const prevDataInicial = dataAtual.clone().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
          const prevDataFim = dataAtual.clone().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');

          const oracleTotaisPrev = await getVendasTotaisOracle(
            oracleConnection,
            prevDataInicial,
            prevDataFim,
            codFilialNorm,
            vendedor.rca,
            filtros.departamentos,
            filtros.secoes
          );

          // Agregar métricas a partir das diárias do mês anterior
          let totaisPrevBase;
          try {
            const vendasDiariasPrev = await getVendasDiarias(
              oracleConnection,
              prevDataInicial,
              prevDataFim,
              codFilialNorm,
              vendedor.rca,
              filtros.departamentos,
              filtros.secoes
            );

            totaisPrevBase = calcularTotais(vendasDiariasPrev) || {
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
          } catch (ePrevDiarias) {
            writeLog(`Falha ao obter diárias do mês anterior para agregação: ${ePrevDiarias.message}`);
            totaisPrevBase = {
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
          }

          // Sobrepor vendas/devoluções com os totais mensais do Oracle
          totaisPrevBase.total_vlvendadodia = toNumberSafe(oracleTotaisPrev.vlvenda);
          totaisPrevBase.total_vldevolucao = toNumberSafe(oracleTotaisPrev.vldevolucao);
          totaisPrevBase.total_valor = toNumberSafe(totaisPrevBase.total_vlvendadodia - totaisPrevBase.total_vldevolucao);

          const vendaTotalPrev = {
            codusur: vendedor.rca,
            nome: vendedor.nome,
            data_inicio: prevDataInicial,
            data_fim: prevDataFim,
            ...totaisPrevBase
          };

          const resultadoTotalPrev = await cadastrarVendaTotal(token, vendaTotalPrev);
          if (resultadoTotalPrev.success) {
            if (resultadoTotalPrev.updated) {
              totalVendasTotaisAtualizadas++;
              writeLog(`Venda total (mês anterior) atualizada para vendedor ${vendedor.nome} (RCA: ${vendedor.rca}). Período: ${prevDataInicial} a ${prevDataFim}`);
            } else {
              totalVendasTotaisCadastradas++;
              writeLog(`Venda total (mês anterior) cadastrada para vendedor ${vendedor.nome} (RCA: ${vendedor.rca}). Período: ${prevDataInicial} a ${prevDataFim}`);
            }
          } else if (resultadoTotalPrev.message === 'Registro já existe') {
            totalVendasTotaisJaExistentes++;
            writeLog(`Venda total (mês anterior) já existe para vendedor ${vendedor.nome} (RCA: ${vendedor.rca}). Período: ${prevDataInicial} a ${prevDataFim}`);
          }
        } catch (prevError) {
          writeLog(`Erro ao consolidar mês anterior para vendedor ${vendedor.nome} (RCA: ${vendedor.rca}): ${prevError.message}`);
          console.error(`Erro ao consolidar mês anterior para vendedor ${vendedor.nome}: ${prevError.message}`);
        }
        
        // Obter vendas diárias do Oracle
        const vendasDiarias = await getVendasDiarias(
          oracleConnection,
          dataInicial,
          dataFinal,
          codFilialNorm,
          vendedor.rca,
          filtros.departamentos,
          filtros.secoes
        );
        
        if (!vendasDiarias || vendasDiarias.length === 0) {
          writeLog(`Nenhuma venda encontrada para o vendedor ${vendedor.nome} (RCA: ${vendedor.rca}).`);
          console.log(`Nenhuma venda encontrada para o vendedor ${vendedor.nome}`);
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
        
        // Calcular totais e cadastrar venda total (sempre, mesmo sem diárias)
        {
          const totaisBase = calcularTotais(vendasDiarias) || {
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

          // Ajustar totais com cálculo mensal direto do Oracle (VLVENDA/VLDEVOLUCAO)
          try {
            const oracleTotaisAtual = await getVendasTotaisOracle(
              oracleConnection,
              dataInicial,
              dataFinal,
              codFilialNorm,
              vendedor.rca,
              filtros.departamentos,
              filtros.secoes
            );

            totaisBase.total_vlvendadodia = toNumberSafe(oracleTotaisAtual.vlvenda);
            totaisBase.total_vldevolucao = toNumberSafe(oracleTotaisAtual.vldevolucao);
            totaisBase.total_valor = toNumberSafe(totaisBase.total_vlvendadodia - totaisBase.total_vldevolucao);

            writeLog(`Totais Oracle aplicados (atual): VLVENDA=${totaisBase.total_vlvendadodia} VLDEVOLUCAO=${totaisBase.total_vldevolucao}`);
          } catch (oracleTotaisError) {
            writeLog(`Falha ao obter totais Oracle do período atual: ${oracleTotaisError.message}`);
            console.error(`Falha ao obter totais Oracle do período atual: ${oracleTotaisError.message}`);
          }
          
          const vendaTotal = {
            codusur: vendedor.rca,
            nome: vendedor.nome,
            data_inicio: dataInicial,
            data_fim: dataFinal,
            ...totaisBase
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

// Sincroniza exclusivamente os totais do mês anterior para todos os vendedores,
// espelhando o comportamento de consolidação usado nos totais da Bijou por filial.
async function syncVendasMesAnterior() {
  let oracleConnection;
  const startTime = new Date();

  console.log('Sincronização de vendas (mês anterior) iniciada.');

  try {
    const token = await getAuthToken();
    console.log('Token obtido com sucesso');
    // Permite filtrar por vendedores específicos via CLI: --prev-only-codusur=108,16
    const codusurArg = process.argv.find(a => a.startsWith('--prev-only-codusur='));
    const filterRCAs = codusurArg ? codusurArg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean) : null;

    let vendedores = [];
    if (filterRCAs && filterRCAs.length > 0) {
      vendedores = await getVendedoresPorRCAs(token, filterRCAs);
      console.log(`Obtidos ${vendedores.length} vendedores por filtro RCA: ${filterRCAs.join(',')}`);
    } else {
      vendedores = await getVendedores(token);
      console.log(`Obtidos ${vendedores.length} vendedores.`);
    }

    const dataAtual = moment();
    const prevDataInicial = dataAtual.clone().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
    const prevDataFim = dataAtual.clone().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
    console.log(`Período anterior: ${prevDataInicial} a ${prevDataFim}`);

    try {
      oracleConnection = await criarConexaoOracle();
    } catch (dbError) {
      console.error(`Erro ao conectar ao Oracle: ${dbError.message}`);
      throw dbError;
    }

    let totalVendedores = 0;
    let totCadastradas = 0;
    let totAtualizadas = 0;
    let totJaExistentes = 0;

    for (const vendedor of vendedores) {
      if (!vendedor.rca || !vendedor.filial || !vendedor.filial.codigo) {
        console.log(`Pulando vendedor ${vendedor.nome}: RCA ou filial não configurada`);
        continue;
      }

      totalVendedores++;
      console.log(`Processando vendedor (mês anterior): ${vendedor.nome}, RCA: ${vendedor.rca}, Filial: ${vendedor.filial.codigo}`);

      try {
        const filtros = await getVendedorFiltros(token, vendedor.id);
        oracleConnection = await verificarConexaoOracle(oracleConnection);
        const codFilialNorm = normalizeCodigoFilial(vendedor.filial.codigo);

        const oracleTotaisPrev = await getVendasTotaisOracle(
          oracleConnection,
          prevDataInicial,
          prevDataFim,
          codFilialNorm,
          vendedor.rca,
          filtros.departamentos,
          filtros.secoes
        );

        let totaisPrevBase;
        try {
          const vendasDiariasPrev = await getVendasDiarias(
            oracleConnection,
            prevDataInicial,
            prevDataFim,
            codFilialNorm,
            vendedor.rca,
            filtros.departamentos,
            filtros.secoes
          );
          totaisPrevBase = calcularTotais(vendasDiariasPrev) || {
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
        } catch (ePrevDiarias) {
          console.log(`Falha ao obter diárias do mês anterior para agregação: ${ePrevDiarias.message}`);
          totaisPrevBase = {
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
        }

        totaisPrevBase.total_vlvendadodia = toNumberSafe(oracleTotaisPrev.vlvenda);
        totaisPrevBase.total_vldevolucao = toNumberSafe(oracleTotaisPrev.vldevolucao);
        totaisPrevBase.total_valor = toNumberSafe(totaisPrevBase.total_vlvendadodia - totaisPrevBase.total_vldevolucao);

        const vendaTotalPrev = {
          codusur: vendedor.rca,
          nome: vendedor.nome,
          data_inicio: prevDataInicial,
          data_fim: prevDataFim,
          ...totaisPrevBase
        };

        const resultadoTotalPrev = await cadastrarVendaTotal(token, vendaTotalPrev);
        if (resultadoTotalPrev.success) {
          if (resultadoTotalPrev.updated) {
            totAtualizadas++;
            console.log(`Venda total (mês anterior) atualizada: RCA ${vendedor.rca}, período ${prevDataInicial} a ${prevDataFim}`);
          } else {
            totCadastradas++;
            console.log(`Venda total (mês anterior) cadastrada: RCA ${vendedor.rca}, período ${prevDataInicial} a ${prevDataFim}`);
          }
        } else if (resultadoTotalPrev.message === 'Registro já existe') {
          totJaExistentes++;
          console.log(`Venda total (mês anterior) já existente: RCA ${vendedor.rca}, período ${prevDataInicial} a ${prevDataFim}`);
        }
      } catch (prevError) {
        console.error(`Erro ao consolidar mês anterior para vendedor ${vendedor.nome} (RCA: ${vendedor.rca}): ${prevError.message}`);
      }
    }

    try { await oracleConnection.close(); } catch {}

    const endTime = new Date();
    console.log(`Sincronização do mês anterior finalizada. Vendedores: ${totalVendedores}, cadastradas=${totCadastradas}, atualizadas=${totAtualizadas}, existentes=${totJaExistentes}. Duração: ${((endTime - startTime)/1000).toFixed(3)}s.`);
  } catch (error) {
    console.error(`Erro na sincronização do mês anterior: ${error.message}`);
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

// Orquestrador: sincroniza vendas e Bijou (filial - departamentos e seções)
async function syncVendasComBijouFilial() {
  console.log('[orchestrator] Iniciando sync de Vendedor + Bijou (filial deptos/seções)');
  try {
    await syncVendas();
  } catch (e) {
    console.error('[orchestrator] Falha em syncVendas:', e && e.message ? e.message : e);
  }

  try {
    await syncBijouFilial();
  } catch (e) {
    console.error('[orchestrator] Falha em syncBijouFilial:', e && e.message ? e.message : e);
  }

  try {
    await syncBijouFilialSecoes();
  } catch (e) {
    console.error('[orchestrator] Falha em syncBijouFilialSecoes:', e && e.message ? e.message : e);
  }

  try {
    await syncBijouVendedorSecoes();
  } catch (e) {
    console.error('[orchestrator] Falha em syncBijouVendedorSecoes:', e && e.message ? e.message : e);
  }

  console.log('[orchestrator] Concluído sync de Vendedor + Bijou (filial deptos/seções)');
}

// Agendar sincronização a cada 5 minutos
// Modo de teste: executar apenas Bijou para uma filial passada via CLI
const bijouTestArg = process.argv.find(a => a.startsWith('--bijou-filial='));
const isBijouTest = Boolean(bijouTestArg);
const prevOnlyArg = process.argv.includes('--prev-only');

if (!isBijouTest) {
  if (!prevOnlyArg) {
    schedule.scheduleJob('*/5 * * * *', () => {
      console.log(`Orquestrador: vendas + Bijou filial + vendedor seções iniciado em: ${new Date().toLocaleString()}`);
      syncVendasComBijouFilial();
    });

    // Agendar sincronização de departamentos e seções diariamente às 01:00
    schedule.scheduleJob('0 1 * * *', () => {
      console.log(`Sincronização de departamentos e seções iniciada em: ${new Date().toLocaleString()}`);
      syncDepartamentosSecoes();
    });

    // Agendar sincronização de Bijou/Make/Bolsas por Filial diariamente às 02:15
    schedule.scheduleJob('15 2 * * *', () => {
      console.log(`Sincronização de Bijou/Make/Bolsas por Filial iniciada em: ${new Date().toLocaleString()}`);
      syncBijouFilial();
    });

    // Agendar sincronização de Bijou Seções por Filial diariamente às 02:20
    schedule.scheduleJob('20 2 * * *', () => {
      console.log(`Sincronização de Bijou Seções por Filial iniciada em: ${new Date().toLocaleString()}`);
      syncBijouFilialSecoes();
    });

    // Agendar sincronização de Bijou Seções por Vendedor diariamente às 02:25
    schedule.scheduleJob('25 2 * * *', () => {
      console.log(`Sincronização de Bijou Seções por Vendedor iniciada em: ${new Date().toLocaleString()}`);
      syncBijouVendedorSecoes();
    });

    // Executar sincronização imediatamente ao iniciar
    syncVendasComBijouFilial();
    syncDepartamentosSecoes();

    console.log('Sincronização de vendas agendada a cada 5 minutos.');
    console.log('Sincronização de departamentos e seções agendada diariamente às 01:00.');
    console.log('Sincronização de Bijou/Make/Bolsas por Filial agendada diariamente às 02:15.');
    console.log('Sincronização de Bijou Seções por Filial agendada diariamente às 02:20.');
    console.log('Sincronização de Bijou Seções por Vendedor agendada diariamente às 02:25.');
  } else {
    // Executa exclusivamente a consolidação do mês anterior
    syncVendasMesAnterior();
  }
} else {
  const filialCodigo = bijouTestArg.split('=')[1];
  const bijouDiArg = process.argv.find(a => a.startsWith('--bijou-di='));
  const bijouDfArg = process.argv.find(a => a.startsWith('--bijou-df='));
  const dtIniOverride = bijouDiArg ? bijouDiArg.split('=')[1] : null;
  const dtFimOverride = bijouDfArg ? bijouDfArg.split('=')[1] : null;
  runBijouTest(filialCodigo, dtIniOverride, dtFimOverride);
}

// Garante a existência das tabelas necessárias para Bijou
async function ensureBijouTablesExist(mysqlConnection) {
  // bijou_filial_config
  await mysqlConnection.query(`
    CREATE TABLE IF NOT EXISTS bijou_filial_config (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filial_id INT NOT NULL,
      departamentos VARCHAR(255) DEFAULT NULL,
      secoes VARCHAR(255) DEFAULT NULL,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_bijou_filial_config_filial FOREIGN KEY (filial_id) REFERENCES filiais(id) ON DELETE CASCADE,
      UNIQUE KEY uniq_bijou_filial_config_filial (filial_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // bijou_filial_totais
  await mysqlConnection.query(`
    CREATE TABLE IF NOT EXISTS bijou_filial_totais (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filial_id INT NOT NULL,
      codfilial VARCHAR(20) NOT NULL,
      mes INT NOT NULL,
      ano INT NOT NULL,
      data_inicio DATE NOT NULL,
      data_fim DATE NOT NULL,
      valor_total DECIMAL(14,2) NOT NULL DEFAULT 0,
      config_key VARCHAR(100) NOT NULL,
      departamentos VARCHAR(255) DEFAULT NULL,
      secoes VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_bijou_filial_totais_filial FOREIGN KEY (filial_id) REFERENCES filiais(id) ON DELETE CASCADE,
      UNIQUE KEY uniq_bijou_filial_period (filial_id, mes, ano, config_key),
      KEY idx_config_key (config_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // bijou_filial_secoes_config
  await mysqlConnection.query(`
    CREATE TABLE IF NOT EXISTS bijou_filial_secoes_config (
      filial_id INT NOT NULL PRIMARY KEY,
      departamentos VARCHAR(1000) DEFAULT NULL,
      secoes VARCHAR(2000) DEFAULT NULL,
      ativo TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_bijou_filial_secoes_config_filial FOREIGN KEY (filial_id) REFERENCES filiais(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // bijou_filial_secoes_totais
  await mysqlConnection.query(`
    CREATE TABLE IF NOT EXISTS bijou_filial_secoes_totais (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filial_id INT NOT NULL,
      codfilial VARCHAR(20) NOT NULL,
      mes INT NOT NULL,
      ano INT NOT NULL,
      data_inicio DATE NOT NULL,
      data_fim DATE NOT NULL,
      valor_total DECIMAL(14,2) NOT NULL DEFAULT 0,
      config_key VARCHAR(100) NOT NULL,
      departamentos VARCHAR(255) DEFAULT NULL,
      secoes VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_bijou_filial_secoes_totais_filial FOREIGN KEY (filial_id) REFERENCES filiais(id) ON DELETE CASCADE,
      UNIQUE KEY uniq_bijou_filial_secoes_period (filial_id, mes, ano, config_key),
      KEY idx_config_key_filial_secoes (config_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // bijou_vendedor_secoes_config
  await mysqlConnection.query(`
    CREATE TABLE IF NOT EXISTS bijou_vendedor_secoes_config (
      vendedor_id INT NOT NULL PRIMARY KEY,
      departamentos VARCHAR(1000) DEFAULT NULL,
      secoes VARCHAR(2000) DEFAULT NULL,
      ativo TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_bijou_vendedor_secoes_config_vendedor FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // bijou_vendedor_secoes_totais
  await mysqlConnection.query(`
    CREATE TABLE IF NOT EXISTS bijou_vendedor_secoes_totais (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vendedor_id INT NOT NULL,
      codusur VARCHAR(20) NOT NULL,
      mes INT NOT NULL,
      ano INT NOT NULL,
      data_inicio DATE NOT NULL,
      data_fim DATE NOT NULL,
      valor_total DECIMAL(14,2) NOT NULL DEFAULT 0,
      config_key VARCHAR(100) NOT NULL,
      departamentos VARCHAR(255) DEFAULT NULL,
      secoes VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_bijou_vendedor_secoes_totais_vendedor FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE CASCADE,
      UNIQUE KEY uniq_bijou_vendedor_secoes_period (vendedor_id, mes, ano, config_key),
      KEY idx_config_key_vendedor_secoes (config_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Migração de colunas ausentes
  await ensureBijouTablesSchema(mysqlConnection);
}

async function ensureBijouTablesSchema(mysqlConnection) {
  // Helper para checar existência de coluna
  const columnExists = async (table, column) => {
    const [rows] = await mysqlConnection.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    return rows && rows[0] && Number(rows[0].cnt) > 0;
  };

  // bijou_filial_config: garantir filial_id, departamentos, secoes, ativo
  if (!(await columnExists('bijou_filial_config', 'filial_id'))) {
    await mysqlConnection.query(`ALTER TABLE bijou_filial_config ADD COLUMN filial_id INT NULL`);
  }
  if (!(await columnExists('bijou_filial_config', 'departamentos'))) {
    await mysqlConnection.query(`ALTER TABLE bijou_filial_config ADD COLUMN departamentos VARCHAR(255) DEFAULT NULL`);
  }
  if (!(await columnExists('bijou_filial_config', 'secoes'))) {
    await mysqlConnection.query(`ALTER TABLE bijou_filial_config ADD COLUMN secoes VARCHAR(255) DEFAULT NULL`);
  }
  if (!(await columnExists('bijou_filial_config', 'ativo'))) {
    await mysqlConnection.query(`ALTER TABLE bijou_filial_config ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1`);
  }

  // bijou_filial_totais: garantir codfilial e config_key
  if (!(await columnExists('bijou_filial_totais', 'codfilial'))) {
    await mysqlConnection.query(`ALTER TABLE bijou_filial_totais ADD COLUMN codfilial VARCHAR(20) NOT NULL AFTER filial_id`);
  }
  if (!(await columnExists('bijou_filial_totais', 'config_key'))) {
    await mysqlConnection.query(`ALTER TABLE bijou_filial_totais ADD COLUMN config_key VARCHAR(100) NOT NULL`);
  }

  // bijou_filial_secoes_totais: garantir codfilial e config_key
  if (!(await columnExists('bijou_filial_secoes_totais', 'codfilial'))) {
    await mysqlConnection.query(`ALTER TABLE bijou_filial_secoes_totais ADD COLUMN codfilial VARCHAR(20) NOT NULL AFTER filial_id`);
  }
  if (!(await columnExists('bijou_filial_secoes_totais', 'config_key'))) {
    await mysqlConnection.query(`ALTER TABLE bijou_filial_secoes_totais ADD COLUMN config_key VARCHAR(100) NOT NULL`);
  }

  // bijou_vendedor_secoes_totais: garantir codusur e config_key
  if (!(await columnExists('bijou_vendedor_secoes_totais', 'codusur'))) {
    await mysqlConnection.query(`ALTER TABLE bijou_vendedor_secoes_totais ADD COLUMN codusur VARCHAR(20) NOT NULL AFTER vendedor_id`);
  }
  if (!(await columnExists('bijou_vendedor_secoes_totais', 'config_key'))) {
    await mysqlConnection.query(`ALTER TABLE bijou_vendedor_secoes_totais ADD COLUMN config_key VARCHAR(100) NOT NULL`);
  }

  // Aumentar capacidade das colunas de CSV de filtros quando necessário
  const ensureColumnLength = async (table, column, targetLength) => {
    const [rows] = await mysqlConnection.query(
      `SELECT CHARACTER_MAXIMUM_LENGTH AS len FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    const len = rows && rows[0] && rows[0].len ? Number(rows[0].len) : null;
    if (len && len < targetLength) {
      await mysqlConnection.query(`ALTER TABLE ${table} MODIFY COLUMN ${column} VARCHAR(${targetLength}) DEFAULT NULL`);
      console.log(`[Schema] ${table}.${column} alterado para VARCHAR(${targetLength})`);
    }
  };

  await ensureColumnLength('bijou_vendedor_secoes_totais', 'departamentos', 1000);
  await ensureColumnLength('bijou_vendedor_secoes_totais', 'secoes', 2000);
  await ensureColumnLength('bijou_filial_secoes_totais', 'departamentos', 1000);
  await ensureColumnLength('bijou_filial_secoes_totais', 'secoes', 2000);
}

// Listar configuração Bijou Seções por filial no MySQL
async function listarBijouFilialSecoesConfigMySQL(mysqlConn) {
  const [rows] = await mysqlConn.execute(`
    SELECT c.filial_id, f.codigo, c.departamentos, c.secoes, c.ativo
    FROM bijou_filial_secoes_config c
    JOIN filiais f ON f.id = c.filial_id
    WHERE c.ativo = 1
  `);
  return rows.map(r => ({
    filial_id: r.filial_id,
    codigo: normalizeCodigoFilial(r.codigo),
    departamentosCSV: (r.departamentos || '').trim() || null,
    secoesCSV: (r.secoes || '').trim() || null,
  }));
}

// Upsert de totais Bijou Seções por Filial
async function upsertTotaisBijouFilialSecoes(mysqlConn, totals, periodo, config) {
  const { mes, ano, data_inicio, data_fim } = periodo;
  const { departamentosCSV, secoesCSV } = config;
  const configKey = `deptos=${departamentosCSV || ''}|secoes=${secoesCSV || ''}`;

  const [filiaisRows] = await mysqlConn.execute('SELECT id, codigo FROM filiais');
  const filialIdByCodigo = new Map(filiaisRows.map(r => [normalizeCodigoFilial(r.codigo), r.id]));

  const insertSQL = `
    INSERT INTO bijou_filial_secoes_totais
      (filial_id, codfilial, mes, ano, data_inicio, data_fim, valor_total, config_key, departamentos, secoes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      valor_total = VALUES(valor_total),
      data_inicio = VALUES(data_inicio),
      data_fim = VALUES(data_fim),
      updated_at = CURRENT_TIMESTAMP
  `;

  for (const t of totals) {
    const codfilialNorm = normalizeCodigoFilial(t.codfilial);
    const filial_id = filialIdByCodigo.get(codfilialNorm) || null;
    if (!filial_id) {
      console.warn(`[BijouFilialSecoes] Aviso: codfilial ${codfilialNorm} não encontrado em filiais. Pulando upsert.`);
      continue;
    }
    await mysqlConn.execute(insertSQL, [
      filial_id,
      codfilialNorm,
      mes,
      ano,
      moment(data_inicio).format('YYYY-MM-DD'),
      moment(data_fim).format('YYYY-MM-DD'),
      toNumberSafe(t.valor_total),
      configKey,
      departamentosCSV || null,
      secoesCSV || null
    ]);
  }
}

// Sincronização Bijou Seções por Filial (usa mesma consulta com filtros de seções)
async function syncBijouFilialSecoes() {
  console.log('[BijouFilialSecoes] Iniciando sincronização de Bijou por seções (Filial)');
  let oracleConnection;
  let mysqlConnection;
  try {
    oracleConnection = await oracledb.getConnection({
      user: process.env.LCDBUSER,
      password: process.env.LCDBPASS,
      connectString: `${process.env.LCDBHOST}/${process.env.LCDBNAME}`
    });
    mysqlConnection = await criarConexaoMySQL();
    await ensureBijouTablesExist(mysqlConnection);

    const configs = await listarBijouFilialSecoesConfigMySQL(mysqlConnection);
    if (!configs || configs.length === 0) {
      console.log('[BijouFilialSecoes] Nenhuma configuração ativa encontrada. Encerrando.');
      return;
    }

    // Agrupar por combinação de filtros (departamentos/seções), como em Bijou por Filial
    const groups = new Map();
    for (const cfg of configs) {
      const key = `deptos=${cfg.departamentosCSV || ''}|secoes=${cfg.secoesCSV || ''}`;
      if (!groups.has(key)) {
        groups.set(key, { departamentosCSV: cfg.departamentosCSV, secoesCSV: cfg.secoesCSV, filiais: [] });
      }
      if (cfg.codigo) {
        groups.get(key).filiais.push(String(cfg.codigo));
      }
    }

    const now = new Date();
    const mesAtual = now.getMonth() + 1;
    const anoAtual = now.getFullYear();
    const { first: dtIniAtual, last: dtFimAtual } = firstAndLastDayOfMonth(anoAtual, mesAtual);

    const mesAnteriorDate = new Date(anoAtual, mesAtual - 2, 1);
    const mesAnterior = mesAnteriorDate.getMonth() + 1;
    const anoAnterior = mesAnteriorDate.getFullYear();
    const { first: dtIniAnt, last: dtFimAnt } = firstAndLastDayOfMonth(anoAnterior, mesAnterior);

    // Mês atual e anterior por grupo
    for (const group of groups.values()) {
      const filiaisList = Array.from(new Set(group.filiais.map(String))).filter(Boolean);
      if (filiaisList.length === 0) {
        console.warn('[BijouFilialSecoes] Grupo sem filiais, ignorando:', {
          departamentos: group.departamentosCSV,
          secoes: group.secoesCSV
        });
        continue;
      }
      const filiaisCSV = csvFromArray(filiaisList);

      // Mês atual
      const totalsAtual = await consultarTotaisBijouPorFilial(oracleConnection, {
        dtIni: dtIniAtual,
        dtFim: dtFimAtual,
        filiaisCSV,
        deptosCSV: group.departamentosCSV,
        secoesCSV: group.secoesCSV
      });
      await upsertTotaisBijouFilialSecoes(mysqlConnection, totalsAtual, {
        mes: mesAtual,
        ano: anoAtual,
        data_inicio: dtIniAtual,
        data_fim: dtFimAtual
      }, { departamentosCSV: group.departamentosCSV, secoesCSV: group.secoesCSV });

      // Mês anterior
      const totalsAnterior = await consultarTotaisBijouPorFilial(oracleConnection, {
        dtIni: dtIniAnt,
        dtFim: dtFimAnt,
        filiaisCSV,
        deptosCSV: group.departamentosCSV,
        secoesCSV: group.secoesCSV
      });
      await upsertTotaisBijouFilialSecoes(mysqlConnection, totalsAnterior, {
        mes: mesAnterior,
        ano: anoAnterior,
        data_inicio: dtIniAnt,
        data_fim: dtFimAnt
      }, { departamentosCSV: group.departamentosCSV, secoesCSV: group.secoesCSV });
    }

    console.log('[BijouFilialSecoes] Concluída sincronização de mês atual e anterior.');
  } catch (e) {
    console.error('[BijouFilialSecoes] Erro na sincronização:', e && e.message ? e.message : e);
  } finally {
    try { if (oracleConnection) await oracleConnection.close(); } catch {}
    try { if (mysqlConnection) await mysqlConnection.end(); } catch {}
  }
}

// Upsert de totais Bijou Seções por Vendedor
async function upsertTotaisBijouVendedorSecoes(mysqlConn, totals, periodo, vendedor) {
  const { mes, ano, data_inicio, data_fim } = periodo;
  const { vendedor_id, codusur, departamentosCSV, secoesCSV } = vendedor;
  const configKey = `deptos=${departamentosCSV || ''}|secoes=${secoesCSV || ''}`;

  const insertSQL = `
    INSERT INTO bijou_vendedor_secoes_totais
      (vendedor_id, codusur, mes, ano, data_inicio, data_fim, valor_total, config_key, departamentos, secoes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      valor_total = VALUES(valor_total),
      data_inicio = VALUES(data_inicio),
      data_fim = VALUES(data_fim),
      updated_at = CURRENT_TIMESTAMP
  `;

  for (const t of totals) {
    await mysqlConn.execute(insertSQL, [
      vendedor_id,
      codusur,
      mes,
      ano,
      moment(data_inicio).format('YYYY-MM-DD'),
      moment(data_fim).format('YYYY-MM-DD'),
      toNumberSafe(t.valor_total),
      configKey,
      departamentosCSV || null,
      secoesCSV || null
    ]);
  }
}

// Listar configuração Bijou Seções por vendedor
async function listarBijouVendedorSecoesConfigMySQL(mysqlConn) {
  const [rows] = await mysqlConn.execute(`
    SELECT vc.vendedor_id, v.rca AS codusur, f.codigo AS codfilial, vc.departamentos, vc.secoes, vc.ativo
    FROM bijou_vendedor_secoes_config vc
    JOIN vendedores v ON v.id = vc.vendedor_id
    LEFT JOIN filiais f ON f.id = v.filial_id
    WHERE vc.ativo = 1
  `);
  return rows.map(r => ({
    vendedor_id: r.vendedor_id,
    codusur: (r.codusur || '').trim(),
    codfilial: normalizeCodigoFilial(r.codfilial || ''),
    departamentosCSV: (r.departamentos || '').trim() || null,
    secoesCSV: (r.secoes || '').trim() || null,
    departamentosList: parseCSVToIntArray((r.departamentos || '').trim()),
    secoesList: parseCSVToIntArray((r.secoes || '').trim()),
  }));
}

// Sincronização Bijou Seções por Vendedor
async function syncBijouVendedorSecoes() {
  console.log('[BijouVendedorSecoes] Iniciando sincronização de Bijou por seções (Vendedor)');
  let oracleConnection;
  let mysqlConnection;
  try {
    oracleConnection = await oracledb.getConnection({
      user: process.env.LCDBUSER,
      password: process.env.LCDBPASS,
      connectString: `${process.env.LCDBHOST}/${process.env.LCDBNAME}`
    });
    mysqlConnection = await criarConexaoMySQL();
    await ensureBijouTablesExist(mysqlConnection);

    const configs = await listarBijouVendedorSecoesConfigMySQL(mysqlConnection);
    if (!configs || configs.length === 0) {
      console.log('[BijouVendedorSecoes] Nenhuma configuração ativa encontrada. Encerrando.');
      return;
    }

    const now = new Date();
    const mesAtual = now.getMonth() + 1;
    const anoAtual = now.getFullYear();
    const { first: dtIniAtual, last: dtFimAtual } = firstAndLastDayOfMonth(anoAtual, mesAtual);

    const mesAnteriorDate = new Date(anoAtual, mesAtual - 2, 1);
    const mesAnterior = mesAnteriorDate.getMonth() + 1;
    const anoAnterior = mesAnteriorDate.getFullYear();
    const { first: dtIniAnt, last: dtFimAnt } = firstAndLastDayOfMonth(anoAnterior, mesAnterior);

    // Para cada vendedor configurado, apurar e upsert
    for (const cfg of configs) {
      if (!cfg.codusur || !cfg.codfilial) {
        console.warn(`[BijouVendedorSecoes] Config inválida: vendedor_id=${cfg.vendedor_id} codusur/codfilial ausentes. Pulando.`);
        continue;
      }
      // Mês atual
      const oracleTotaisAtual = await getVendasTotaisOracle(oracleConnection,
        moment(dtIniAtual).format('YYYY-MM-DD'),
        moment(dtFimAtual).format('YYYY-MM-DD'),
        cfg.codfilial,
        cfg.codusur,
        cfg.departamentosList || null,
        cfg.secoesList || null
      );
      const valorTotalAtual = toNumberSafe(oracleTotaisAtual.vlvenda) - toNumberSafe(oracleTotaisAtual.vldevolucao);
      await upsertTotaisBijouVendedorSecoes(mysqlConnection, [{ valor_total: valorTotalAtual }], {
        mes: mesAtual,
        ano: anoAtual,
        data_inicio: dtIniAtual,
        data_fim: dtFimAtual
      }, cfg);

      // Mês anterior
      const oracleTotaisAnt = await getVendasTotaisOracle(oracleConnection,
        moment(dtIniAnt).format('YYYY-MM-DD'),
        moment(dtFimAnt).format('YYYY-MM-DD'),
        cfg.codfilial,
        cfg.codusur,
        cfg.departamentosList || null,
        cfg.secoesList || null
      );
      const valorTotalAnt = toNumberSafe(oracleTotaisAnt.vlvenda) - toNumberSafe(oracleTotaisAnt.vldevolucao);
      await upsertTotaisBijouVendedorSecoes(mysqlConnection, [{ valor_total: valorTotalAnt }], {
        mes: mesAnterior,
        ano: anoAnterior,
        data_inicio: dtIniAnt,
        data_fim: dtFimAnt
      }, cfg);
    }

    console.log('[BijouVendedorSecoes] Concluída sincronização de mês atual e anterior.');
  } catch (e) {
    console.error('[BijouVendedorSecoes] Erro na sincronização:', e && e.message ? e.message : e);
  } finally {
    try { if (oracleConnection) await oracleConnection.close(); } catch {}
    try { if (mysqlConnection) await mysqlConnection.end(); } catch {}
  }
}

async function logBijouTotalsForFilial(mysqlConn, codfilial) {
  try {
    const [rows] = await mysqlConn.query(
      `SELECT filial_id, codfilial, mes, ano, valor_total, data_inicio, data_fim, config_key
       FROM bijou_filial_totais
       WHERE codfilial = ?
       ORDER BY ano DESC, mes DESC
       LIMIT 5`,
      [codfilial]
    );
    if (!rows || rows.length === 0) {
      console.warn(`[BijouFilial][TESTE] Nenhum registro encontrado em bijou_filial_totais para codfilial=${codfilial}`);
      return;
    }
    console.log('[BijouFilial][TESTE] Últimos registros inseridos/atualizados:');
    for (const r of rows) {
      console.log(`  -> filial_id=${r.filial_id} codfilial=${r.codfilial} mes=${r.mes} ano=${r.ano} total=${Number(r.valor_total).toFixed(2)} intervalo=${r.data_inicio}..${r.data_fim} key=${r.config_key}`);
    }
  } catch (e) {
    console.warn('[BijouFilial][TESTE] Falha ao consultar registros:', e && e.message ? e.message : e);
  }
}

// Conversão robusta de decimais vindos do Oracle (ponto e vírgula)
function toNumberSafe(value) {
  if (value == null) return 0;
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  if (typeof value === 'string') {
    let s = value.trim();
    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}