require("dotenv/config");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const oracledb = require("oracledb");
const crypto = require("crypto");
const axios = require("axios");
const { format } = require("date-fns");

// Variáveis globais
let oracleConnection;
let monitorInterval; // Variável para controlar o intervalo de monitoramento
let loginInterval; // Variável para controlar o intervalo de login
let reconnectInterval; // Variável para controlar tentativas de reconexão
let oracleClientPath;
let token;
let isConnected = false; // Flag para controlar status da conexão
let isReconnecting = false; // Flag para evitar múltiplas tentativas simultâneas

// Configuração do caminho do Oracle Client
// No ambiente Node.js puro, precisamos apenas do caminho relativo ou absoluto
oracleClientPath = path.resolve(__dirname, "instantclient_19_25");

// Removida a chave de criptografia e a função de descriptografia, pois não são mais necessárias

oracledb.initOracleClient({ libDir: oracleClientPath });

// Função para enviar logs
function sendLog(message) {
  console.log(message);
}

// Função para conectar ao Oracle Database
async function connectToOracle() {
  try {
    sendLog('Tentando conectar ao Oracle Database...');
    
    oracleConnection = await oracledb.getConnection({
      user: process.env.LCDBUSER,
      password: process.env.LCDBPASS,
      connectString: `${process.env.LCDBHOST}/${process.env.LCDBNAME}`,
    });
    
    isConnected = true;
    isReconnecting = false;
    sendLog('✅ Conectado ao Oracle Database com sucesso!');
    
    // Limpar intervalo de reconexão se existir
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }
    
    return true;
  } catch (error) {
    isConnected = false;
    sendLog(`❌ Erro ao conectar ao Oracle Database: ${error.message}`);
    return false;
  }
}

// Função para verificar se a conexão está ativa
async function checkConnection() {
  if (!oracleConnection || !isConnected) {
    return false;
  }
  
  try {
    // Teste simples de conexão
    await oracleConnection.execute('SELECT 1 FROM DUAL');
    return true;
  } catch (error) {
    sendLog(`⚠️ Conexão Oracle perdida: ${error.message}`);
    isConnected = false;
    return false;
  }
}

// Função para iniciar tentativas de reconexão
function startReconnection() {
  if (isReconnecting) {
    return; // Já está tentando reconectar
  }
  
  isReconnecting = true;
  sendLog('🔄 Iniciando tentativas de reconexão ao Oracle Database...');
  
  // Tentar reconectar imediatamente
  connectToOracle();
  
  // Configurar tentativas a cada 5 segundos
  reconnectInterval = setInterval(async () => {
    if (!isConnected) {
      sendLog('🔄 Tentando reconectar ao Oracle Database...');
      await connectToOracle();
    }
  }, 5000);
}

// Função wrapper para executar queries com reconexão automática
async function executeQuery(query, params = {}, options = {}) {
  // Verificar se a conexão está ativa
  const connectionActive = await checkConnection();
  
  if (!connectionActive) {
    sendLog('⚠️ Conexão Oracle não disponível, iniciando reconexão...');
    startReconnection();
    throw new Error('Conexão Oracle não disponível. Tentando reconectar...');
  }
  
  try {
    const result = await oracleConnection.execute(query, params, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...options
    });
    return result;
  } catch (error) {
    sendLog(`❌ Erro ao executar query: ${error.message}`);
    
    // Se for erro de conexão, iniciar reconexão
    if (error.message.includes('ORA-') || error.message.includes('connection')) {
      isConnected = false;
      startReconnection();
    }
    
    throw error;
  }
}

const sanitizeData = (data) => {
  return data !== undefined ? data : null;
};

// Função para aguardar conexão Oracle estar disponível
async function waitForConnection(maxWaitTime = 30000) {
  const startTime = Date.now();
  
  while (!isConnected && (Date.now() - startTime) < maxWaitTime) {
    sendLog('⏳ Aguardando conexão Oracle ficar disponível...');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return isConnected;
}

const updateRequestStatus = async (requestId, status) => {
  require("dotenv/config");
  const data = {
    id: requestId,
    ...status,
  };
  const authConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  await axios
    .post(`${process.env.EXDAPIURL}/request_update.php`, data, authConfig)
    .then((response) => {
      console.log(
        `Status da requisição ${requestId} atualizado: ${response.data.message}`
      );
      sendLog(
        `Status da requisição ${requestId} atualizado: ${response.data.message}`
      );
    })
    .catch((error) => {
      console.error("Erro ao atualizar status da requisição:", error);
      sendLog("Erro ao atualizar status da requisição:", error);
    });
};

const insertRequest = async (requestData) => {
  require("dotenv/config");
  // console.log(requestData);
  const data = {
    filial: requestData.filial,
    caixa: requestData.caixa,
    datavendas: requestData.datavendas,
    processando: requestData.processando || false, // Valor padrão: false
    completed: requestData.completed || false, // Valor padrão: false
    error: requestData.error || false, // Valor padrão: false
    initial: requestData.initial || false, // Valor padrão: false
    message: requestData.message || null, // Valor padrão: null
    nregistros: requestData.nregistros || 0, // Valor padrão: 0
  };

  const headers = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  await axios
    .post(`${process.env.EXDAPIURL}/request_initial.php`, data, headers)
    .then((response) => {
      console.log("Requisição inserida com sucesso.");
      sendLog("Requisição inserida com sucesso.");
    })
    .catch((error) => {
      console.error("Erro ao inserir requisição:", error);
      sendLog("Erro ao inserir requisição:", error);
    });
};

const insertIntoDatabase = async (pedidos) => {
  try {
    // Preparar array de pedidos para envio em lote
    const pedidosProcessados = [];

    for (const pedido of pedidos) {
      // Calcular total de itens e cancelados
      const totalItens = pedido.items.reduce((total, item) => {
        const valor = parseFloat(item.PVENDA) || 0;
        return total + valor;
      }, 0);

      const totalCancelados = pedido.cancelados.reduce((total, cancelado) => {
        const valor = parseFloat(cancelado.PVENDA) || 0;
        return total + valor;
      }, 0);

      // Preparar JSON de itens e cancelados
      const itensJSON = pedido.items.map((item) => ({
        EXPORTADO: sanitizeData(item.EXPORTADO),
        CODFILIAL: sanitizeData(item.CODFILIAL),
        NUMPEDECF: sanitizeData(item.NUMPEDECF),
        CODFUNCCX: sanitizeData(item.CODFUNCCX),
        CODFUNCCANCELECF: null,
        NUMCAIXA: sanitizeData(item.NUMCAIXA),
        NUMSERIEEQUIP: sanitizeData(item.NUMSERIEEQUIP),
        CODPROD: sanitizeData(item.CODPROD),
        NUMSEQ: sanitizeData(item.NUMSEQ),
        DATA: sanitizeData(item.DATA),
        CODCLI: sanitizeData(item.CODCLI),
        CODUSUR: sanitizeData(item.CODUSUR),
        QT: sanitizeData(item.QT),
        PVENDA: sanitizeData(item.PVENDA),
        PTABELA: sanitizeData(item.PTABELA),
        NUMCOO: sanitizeData(item.NUMCOO),
        ST: sanitizeData(item.ST),
        PERDESC: sanitizeData(item.PERDESC),
        QTFALTA: sanitizeData(item.QTFALTA),
        CODST: sanitizeData(item.CODST),
        PORIGINAL: sanitizeData(item.PORIGINAL),
        DTEXPORTACAO: sanitizeData(item.DTEXPORTACAO),
        CODECF: sanitizeData(item.CODECF),
        CODFISCAL: sanitizeData(item.CODFISCAL),
        DESCRICAOPAF: sanitizeData(item.DESCRICAOPAF),
        CODFORNEC: sanitizeData(item.CODFORNEC),
        CODCOB: sanitizeData(item.CODCOB),
      }));

      const canceladosJSON = pedido.cancelados.map((cancelado) => ({
        EXPORTADO: sanitizeData(cancelado.EXPORTADO),
        CODFILIAL: sanitizeData(cancelado.CODFILIAL),
        NUMPEDECF: sanitizeData(cancelado.NUMPEDECF),
        CODFUNCCX: sanitizeData(cancelado.CODFUNCCX),
        CODFUNCCANCELECF: sanitizeData(cancelado.CODFUNCCANCELECF),
        NUMCAIXA: sanitizeData(cancelado.NUMCAIXA),
        NUMSERIEEQUIP: sanitizeData(cancelado.NUMSERIEEQUIP),
        CODPROD: sanitizeData(cancelado.CODPROD),
        NUMSEQ: sanitizeData(cancelado.NUMSEQ),
        DATA: sanitizeData(cancelado.DATA),
        CODCLI: sanitizeData(cancelado.CODCLI),
        CODUSUR: sanitizeData(cancelado.CODUSUR),
        QT: sanitizeData(cancelado.QT),
        PVENDA: sanitizeData(cancelado.PVENDA),
        PTABELA: sanitizeData(cancelado.PTABELA),
        NUMCOO: sanitizeData(cancelado.NUMCOO),
        ST: sanitizeData(cancelado.ST),
        PERDESC: sanitizeData(cancelado.PERDESC),
        QTFALTA: sanitizeData(cancelado.QTFALTA),
        CODST: sanitizeData(cancelado.CODST),
        PORIGINAL: sanitizeData(cancelado.PORIGINAL),
        DTEXPORTACAO: sanitizeData(cancelado.DTEXPORTACAO),
        CODECF: sanitizeData(cancelado.CODECF),
        CODFISCAL: sanitizeData(cancelado.CODFISCAL),
        DESCRICAOPAF: sanitizeData(cancelado.DESCRICAOPAF),
        CODFORNEC: sanitizeData(cancelado.CODFORNEC),
        CODCOB: null,
      }));

      const dataJson = {
        pedido: sanitizeData(pedido.pedido),
        filial: sanitizeData(pedido.filial),
        caixa: sanitizeData(pedido.caixa),
        data: sanitizeData(pedido.data),
        funccx: sanitizeData(pedido.funccx),
        itens: itensJSON,
        cancelados: canceladosJSON,
        codcob: sanitizeData(
          pedido.items.length ? pedido.items[0].CODCOB : null
        ),
        total_itens: totalItens,
        total_cancelados: totalCancelados,
        data_registro_produto: sanitizeData(
          pedido.items.length
            ? pedido.items[0].DTEXPORTACAO
            : pedido.cancelados.length
            ? pedido.cancelados[0].DTEXPORTACAO
            : null
        ),
        vendedor: sanitizeData(
          pedido.items.length
            ? pedido.items[0].CODUSUR
            : pedido.cancelados.length
            ? pedido.cancelados[0].CODUSUR
            : null
        ),
      };

      pedidosProcessados.push(dataJson);
    }

    // Enviar todos os pedidos em uma única requisição
    if (pedidosProcessados.length > 0) {
      console.log(`Enviando ${pedidosProcessados.length} pedidos em lote...`);
      sendLog(`Enviando ${pedidosProcessados.length} pedidos em lote...`);

      const batchData = {
        pedidos: pedidosProcessados
      };

      const headers = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      };

      await axios
        .post(`${process.env.EXDAPIURL}/pedidos_register_batch.php`, batchData, headers)
        .then((response) => {
          console.log(`Lote de ${pedidosProcessados.length} pedidos inserido com sucesso.`);
          sendLog(`Lote de ${pedidosProcessados.length} pedidos inserido com sucesso.`);
          
          // Log individual dos pedidos processados
          pedidosProcessados.forEach(pedido => {
            console.log(
              `Pedido ${pedido.pedido} da data: ${format(
                pedido.data,
                "dd'/'MM'/'yyyy"
              )} inserido com sucesso. Total itens: ${pedido.total_itens}, Total cancelados: ${pedido.total_cancelados}`
            );
          });
        })
        .catch((error) => {
          console.error("Erro ao inserir lote de pedidos:", error.response?.data || error.message);
          sendLog("Erro ao inserir lote de pedidos:", error.response?.data || error.message);
          throw error;
        });
    }

    console.log(
      "Todos os dados foram inseridos com sucesso no banco de dados."
    );
    sendLog("Todos os dados foram inseridos com sucesso no banco de dados.");
  } catch (error) {
    console.error("Erro ao inserir dados no Banco de dados:", error);
    sendLog("Erro ao inserir dados no Banco de dados:", error);
    throw error; // Propaga o erro para ser tratado no nível superior
  }
};

const processRequest = async (request) => {
  const { id, filial, caixa, datavendas } = request;
  const numFilial = Number(filial);
  const numCaixa = Number(caixa);

  try {
    sendLog(
      `Processando dados da requisição ID: ${id} FILIAL: ${filial} CAIXA: ${caixa}`
    );
    
    // Verificar se a conexão está disponível antes de prosseguir
    if (!isConnected) {
      sendLog('⚠️ Conexão Oracle não disponível para processar requisição.');
      await updateRequestStatus(id, {
        processando: false,
        completed: false,
        error: true,
        message: 'Conexão Oracle não disponível. Tentando reconectar...',
        nregistros: 0,
      });
      return;
    }
    // Atualizar status para "processando"
    await updateRequestStatus(id, {
      processando: true,
      completed: false,
      error: false,
      message: "Processando...",
      nregistros: 0,
    });

    // Converter data para o formato DD/MM/YYYY
    const formatDateToDDMMYYYY = (isoString) => {
      const date = new Date(isoString);
      const day = String(date.getUTCDate()).padStart(2, "0");
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const year = date.getUTCFullYear();
      return `${day}/${month}/${year}`;
    };

    const data_venda = formatDateToDDMMYYYY(datavendas);

    // Consultar Oracle (mantendo as consultas originais)
    const queryPCPEDIECF = `
      SELECT i.*, c.CODCOB
      FROM PCPEDIECF i
      INNER JOIN PCPEDCECF c ON i.NUMPEDECF = c.NUMPEDECF
      WHERE i.DATA = TO_DATE(:data_venda, 'DD/MM/YYYY')
      AND i.CODFILIAL =:numFilial AND i.NUMCAIXA =:numCaixa
      ORDER BY i.DATA, i.NUMPEDECF DESC
    `;

    const queryPCPEDICANCECF = `
      SELECT *
      FROM PCPEDICANCECF
      WHERE DATA = TO_DATE(:data_venda, 'DD/MM/YYYY')
      AND CODFILIAL =:numFilial AND NUMCAIXA =:numCaixa
      ORDER BY DATA, NUMPEDECF DESC
    `;

    const resultVendas = await executeQuery(
      queryPCPEDIECF,
      {
        data_venda: data_venda, // Valor de data_venda
        numFilial: numFilial, // Valor de numFilial
        numCaixa: numCaixa, // Valor de numCaixa
      }
    );

    const resultCancelados = await executeQuery(
      queryPCPEDICANCECF,
      {
        data_venda: data_venda, // Valor de data_venda
        numFilial: numFilial, // Valor de numFilial
        numCaixa: numCaixa, // Valor de numCaixa
      }
    );

    // Estruturar pedidos
    const pedidos = [];

    for (const row of resultVendas.rows) {
      const existingPedido = pedidos.find((p) => p.pedido === row.NUMPEDECF);

      const mappedItem = { ...row };

      if (existingPedido) {
        existingPedido.items.push(mappedItem);
      } else {
        pedidos.push({
          pedido: sanitizeData(row.NUMPEDECF),
          filial: sanitizeData(row.CODFILIAL),
          caixa: sanitizeData(row.NUMCAIXA),
          data: sanitizeData(row.DATA),
          funccx: sanitizeData(row.CODFUNCCX),
          items: [mappedItem],
          cancelados: [],
        });
      }
    }

    for (const row of resultCancelados.rows) {
      const existingPedido = pedidos.find((p) => p.pedido === row.NUMPEDECF);

      const mappedCancelado = { ...row };

      if (existingPedido) {
        existingPedido.cancelados.push(mappedCancelado);
      } else {
        pedidos.push({
          pedido: sanitizeData(row.NUMPEDECF),
          filial: sanitizeData(row.CODFILIAL),
          caixa: sanitizeData(row.NUMCAIXA),
          data: sanitizeData(row.DATA),
          funccx: sanitizeData(row.CODFUNCCX),
          items: [],
          cancelados: [mappedCancelado],
        });
      }
    }

    // Inserir dados no MySQL
    await insertIntoDatabase(pedidos);

    // Atualizar status para "concluído"
    await updateRequestStatus(id, {
      processando: false,
      completed: true,
      error: false,
      message: "Processamento concluído com sucesso.",
      nregistros: pedidos.length,
    });

    sendLog(`Dados da requisição ID: ${id} FILIAL: ${filial} CAIXA: ${caixa} Concluído com sucesso.`);
  } catch (error) {
    console.error("Erro durante o processamento da requisição:", error);
    sendLog("Erro durante o processamento da requisição:", error);
    // Atualizar status para "erro"
    await updateRequestStatus(id, {
      processando: false,
      completed: false,
      error: true,
      message: `Erro: ${error.message}`,
      nregistros: 0,
    });
  }
};

const checkNewRequests = async () => {
  require("dotenv/config");
  const data = {
    filial: process.env.FILIAL,
    caixa: process.env.CAIXA,
  };
  const authConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
  await axios
    .post(`${process.env.EXDAPIURL}/request_index.php`, data, authConfig)
    .then(async (response) => {
      const data = response.data;
      if (data.length > 0) {
        console.log(
          `Encontradas ${data.length} requisições para processar na filial ${process.env.FILIAL}, caixa ${process.env.CAIXA}.`
        );
        sendLog(
          `Encontradas ${data.length} requisições para processar na filial ${process.env.FILIAL}, caixa ${process.env.CAIXA}.`
        );
        // Itera sobre todas as requisições encontradas
        for (const request of data) {
          await processRequest(request);
        }
      }
    })
    .catch((error) => {
      console.error("Erro ao verificar requisições:", error.message);
      sendLog("Erro ao verificar requisições:", error.message);
    });
};

const initialDataSync = async (NREGISTROS) => {
  // Verificar se a conexão está disponível antes de prosseguir
  if (!isConnected) {
    sendLog('⚠️ Conexão Oracle não disponível para sincronização inicial.');
    return;
  }

  const numFilial = Number(process.env.FILIAL);
  const numCaixa = Number(process.env.CAIXA);

  try {
    sendLog(`Sincronização inicial da FILIAL: ${numFilial} CAIXA: ${numCaixa} - Dados do dia atual`);

    // Converter data para o formato DD/MM/YYYY
    const formatDateToDDMMYYYY = (isoString) => {
      const date = new Date(isoString);
      const day = String(date.getUTCDate()).padStart(2, "0");
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const year = date.getUTCFullYear();
      return `${day}/${month}/${year}`;
    };

    const data_venda = formatDateToDDMMYYYY(new Date());

    // Consultar Oracle para obter registros do dia atual
    const query = `
      SELECT * FROM (
        SELECT i.*, c.CODCOB, ROWNUM AS rn 
        FROM PCPEDIECF i
        INNER JOIN PCPEDCECF c ON i.NUMPEDECF = c.NUMPEDECF
        WHERE i.DATA = TO_DATE(:data_venda, 'DD/MM/YYYY')
        AND i.CODFILIAL = :numFilial AND i.NUMCAIXA = :numCaixa
        ORDER BY i.NUMPEDECF DESC
      ) WHERE rn <= :NREGISTROS
    `;

    const queryCancelados = `
      SELECT * FROM (
        SELECT pc.*, ROWNUM AS rn 
        FROM PCPEDICANCECF pc
        WHERE pc.DATA = TO_DATE(:data_venda, 'DD/MM/YYYY')
        AND pc.CODFILIAL = :numFilial AND pc.NUMCAIXA = :numCaixa
        ORDER BY pc.NUMPEDECF DESC
      ) WHERE rn <= :NREGISTROS
    `;

    const resultVendas = await executeQuery(
      query,
      { 
        data_venda: data_venda,
        numFilial: numFilial, 
        numCaixa: numCaixa, 
        NREGISTROS: Number(NREGISTROS) || 50 
      }
    );

    const resultCancelados = await executeQuery(
      queryCancelados,
      { 
        data_venda: data_venda,
        numFilial: numFilial, 
        numCaixa: numCaixa, 
        NREGISTROS: Number(NREGISTROS) || 50 
      }
    );

    // Estruturar pedidos
    const pedidos = [];

    for (const row of resultVendas.rows) {
      const existingPedido = pedidos.find((p) => p.pedido === row.NUMPEDECF);

      const mappedItem = { ...row };

      if (existingPedido) {
        existingPedido.items.push(mappedItem);
      } else {
        pedidos.push({
          pedido: sanitizeData(row.NUMPEDECF),
          filial: sanitizeData(row.CODFILIAL),
          caixa: sanitizeData(row.NUMCAIXA),
          data: sanitizeData(row.DATA),
          funccx: sanitizeData(row.CODFUNCCX),
          items: [mappedItem],
          cancelados: [],
        });
      }
    }

    for (const row of resultCancelados.rows) {
      const existingPedido = pedidos.find((p) => p.pedido === row.NUMPEDECF);

      const mappedCancelado = { ...row };

      if (existingPedido) {
        existingPedido.cancelados.push(mappedCancelado);
      } else {
        pedidos.push({
          pedido: sanitizeData(row.NUMPEDECF),
          filial: sanitizeData(row.CODFILIAL),
          caixa: sanitizeData(row.NUMCAIXA),
          data: sanitizeData(row.DATA),
          funccx: sanitizeData(row.CODFUNCCX),
          items: [],
          cancelados: [mappedCancelado],
        });
      }
    }

    // Inserir dados na API externa
    await insertIntoDatabase(pedidos);

    await insertRequest({
      filial: process.env.FILIAL,
      caixa: process.env.CAIXA,
      datavendas: new Date().toISOString(),
      initial: true,
      message: "Sincronização inicial",
      nregistros: pedidos.length,
    });

    console.log("Sincronização inicial de dados concluída com sucesso.");
    sendLog("Sincronização inicial de dados concluída com sucesso.");
  } catch (error) {
    console.error("Erro durante a sincronização inicial de dados:", error);
    sendLog("Erro durante a sincronização inicial de dados:", error);
    
    // Se for erro de conexão, iniciar reconexão
    if (error.message.includes('Oracle') || error.message.includes('conexão') || error.message.includes('ORA-')) {
      sendLog('🔄 Erro de conexão detectado na sincronização inicial, iniciando reconexão...');
      startReconnection();
    }
  }
};

// Pegar apenas os 5 registros de venda mais recentes do dia atual
const replayDataSync2 = async () => {
  // Verificar se a conexão está disponível antes de prosseguir
  if (!isConnected) {
    sendLog('⚠️ Conexão Oracle não disponível para sincronização de dados recentes.');
    return;
  }

  const numFilial = Number(process.env.FILIAL);
  const numCaixa = Number(process.env.CAIXA);

  try {
    sendLog(`Atualizando dados recentes da FILIAL: ${numFilial} CAIXA: ${numCaixa}`);

    // Converter data para o formato DD/MM/YYYY
    const formatDateToDDMMYYYY = (isoString) => {
      const date = new Date(isoString);
      const day = String(date.getUTCDate()).padStart(2, "0");
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const year = date.getUTCFullYear();
      return `${day}/${month}/${year}`;
    };

    const data_venda = formatDateToDDMMYYYY(new Date());

    const queryPCPEDIECF = `
      SELECT i.*, c.CODCOB
      FROM PCPEDIECF i
      INNER JOIN PCPEDCECF c ON i.NUMPEDECF = c.NUMPEDECF
      WHERE i.DATA = TO_DATE(:data_venda, 'DD/MM/YYYY')
      AND i.CODFILIAL = :numFilial AND i.NUMCAIXA = :numCaixa ORDER BY i.NUMPEDECF DESC
    `;

    const queryPCPEDICANCECF = `
      SELECT pc.*
      FROM PCPEDICANCECF pc
      WHERE pc.DATA = TO_DATE(:data_venda, 'DD/MM/YYYY')
      AND pc.CODFILIAL = :numFilial AND pc.NUMCAIXA = :numCaixa ORDER BY pc.NUMPEDECF DESC
    `;

    const resultVendas = await executeQuery(
      queryPCPEDIECF,
      {
        data_venda: data_venda, // Valor de data_venda
        numFilial: numFilial, // Valor de numFilial
        numCaixa: numCaixa, // Valor de numCaixa
      }
    );

    const resultCancelados = await executeQuery(
      queryPCPEDICANCECF,
      {
        data_venda: data_venda, // Valor de data_venda
        numFilial: numFilial, // Valor de numFilial
        numCaixa: numCaixa, // Valor de numCaixa
      }
    );

    // Estruturar pedidos
    const pedidos = [];

    for (const row of resultVendas.rows) {
      const existingPedido = pedidos.find((p) => p.pedido === row.NUMPEDECF);

      const mappedItem = { ...row };

      if (existingPedido) {
        existingPedido.items.push(mappedItem);
      } else {
        pedidos.push({
          pedido: sanitizeData(row.NUMPEDECF),
          filial: sanitizeData(row.CODFILIAL),
          caixa: sanitizeData(row.NUMCAIXA),
          data: sanitizeData(row.DATA),
          funccx: sanitizeData(row.CODFUNCCX),
          items: [mappedItem],
          cancelados: [],
        });
      }
    }

    for (const row of resultCancelados.rows) {
      const existingPedido = pedidos.find((p) => p.pedido === row.NUMPEDECF);

      const mappedCancelado = { ...row };

      if (existingPedido) {
        existingPedido.cancelados.push(mappedCancelado);
      } else {
        pedidos.push({
          pedido: sanitizeData(row.NUMPEDECF),
          filial: sanitizeData(row.CODFILIAL),
          caixa: sanitizeData(row.NUMCAIXA),
          data: sanitizeData(row.DATA),
          funccx: sanitizeData(row.CODFUNCCX),
          items: [],
          cancelados: [mappedCancelado],
        });
      }
    }

    if (pedidos.length > 0) {
      await insertIntoDatabase(pedidos);
      sendLog(
        `Sincronizados ${pedidos.length} pedidos recentes da FILIAL: ${numFilial} CAIXA: ${numCaixa}`
      );
    }
  } catch (error) {
    console.error("Erro durante o processamento da requisição:", error);
    sendLog("Erro durante o processamento da requisição:", error);
    
    // Se for erro de conexão, iniciar reconexão
    if (error.message.includes('Oracle') || error.message.includes('conexão') || error.message.includes('ORA-')) {
      sendLog('🔄 Erro de conexão detectado, iniciando reconexão...');
      startReconnection();
    }
  }
};

const monitorRequests = async () => {
  // Usar o valor da variável de ambiente se disponível, ou 3000ms (3 segundos) como padrão
  const checkInterval = process.env.CHECK_INTERVAL ? parseInt(process.env.CHECK_INTERVAL) : 3000;
  console.log(`Configurando verificação de requisições a cada ${checkInterval/1000} segundos`);
  
  monitorInterval = setInterval(async () => {
    sendLog("Verificando novas requisições em: " + new Date().toISOString());
    await checkNewRequests();
  }, checkInterval); // Verifica a cada 3 segundos por padrão

  // Renovar o token a cada 10 minutos
  loginInterval = setInterval(async () => {
    await startLogin();
  }, 60000 * 10);
};

async function startLogin() {
  require("dotenv/config");
  console.log("Iniciando o login");
  const bodyJson = {
    email: process.env.EXDUSERAPI,
    password: process.env.EXDPASSAPI, // Removida a descriptografia
  };
  await axios
    .post(`${process.env.EXDAPIURL}/login.php`, bodyJson)
    .then((response) => {
      token = response.data.token;
      console.log("Login realizado com sucesso!");
      sendLog(`Token de acesso gerado com sucesso!`);
    })
    .catch((err) => {
      console.log("Falha ao realizar login");
      sendLog("Falha ao realizar login: " + err);
    });
}

// Função para iniciar o sistema
function start() {
  dotenv.config();
  startLogin();
  sendLog(
    `Processo de sincronização iniciado para o filial: ${process.env.FILIAL}, caixa: ${process.env.CAIXA}`
  );
  
  (async () => {
    try {
      // Conectar ao Oracle com reconexão automática
      const connected = await connectToOracle();
      
      if (!connected) {
        sendLog('⚠️ Falha na conexão inicial, iniciando tentativas de reconexão...');
        startReconnection();
        // Aguardar conexão ficar disponível
        await waitForConnection();
      }

      setTimeout(async () => {
        // Executar sincronização inicial de dados (apenas se conectado)
        if (isConnected) {
          await initialDataSync(process.env.NREGISTROS);
          // Iniciar monitoramento contínuo
          await monitorRequests();
        } else {
          sendLog('⚠️ Aguardando conexão Oracle para iniciar sincronização...');
        }
      }, 3000);
    } catch (error) {
      console.error("Erro durante o processamento:", error);
      sendLog("Erro durante o processamento:" + error);
      // Iniciar reconexão em caso de erro
      startReconnection();
    }
  })();
  
  // Configurar intervalo de sincronização mais frequente (a cada 10 segundos)
  // Usar o valor da variável de ambiente se disponível, ou 10000ms (10 segundos) como padrão
  const syncInterval = process.env.SYNC_INTERVAL ? parseInt(process.env.SYNC_INTERVAL) : 10000;
  console.log(`Configurando sincronização a cada ${syncInterval/1000} segundos`);
  
  setInterval(() => {
    replayDataSync2();
  }, syncInterval);
}

// Função para parar o sistema
function stop() {
  console.log("Parando o sistema...");
  clearInterval(monitorInterval); // Encerra o monitoramento
  clearInterval(loginInterval); // Encerra o monitoramento de login
  if (reconnectInterval) {
    clearInterval(reconnectInterval); // Encerra tentativas de reconexão
  }
  if (oracleConnection) {
    oracleConnection.close(); // Fecha a conexão com o Oracle
  }
  isConnected = false;
  isReconnecting = false;
  console.log("Sistema parado.");
}

// Em Node.js puro, iniciamos diretamente em vez de exportar
start();

// Tratamento de sinais para parar a aplicação corretamente
process.on('SIGINT', () => {
  console.log('Recebido SIGINT. Encerrando o aplicativo...');
  stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Recebido SIGTERM. Encerrando o aplicativo...');
  stop();
  process.exit(0);
});

// Expomos também as funções start e stop para usos avançados
module.exports = { start, stop };