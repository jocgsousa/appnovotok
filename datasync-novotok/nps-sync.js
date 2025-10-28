require('dotenv/config');
const fs = require('fs');
const path = require('path');
const oracledb = require('oracledb');
const axios = require('axios');
const cron = require('node-cron');

// Importar cliente da API e autenticação
const { npsAPI, initializeAuth } = require('./api-client');

// Configuração do Oracle Instant Client
const oracleClientPath = path.resolve(__dirname, 'instantclient_19_25');
oracledb.initOracleClient({ libDir: oracleClientPath });

// Função para registrar logs no arquivo
function writeLog(message) {
  return false;
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const dia = String(now.getDate()).padStart(2, '0');
  
  const logDir = path.resolve(__dirname, 'logs', 'nps', String(ano), mes, dia);
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logFileName = `nps_sync_log_${ano}${mes}${dia}.txt`;
  const logFilePath = path.join(logDir, logFileName);
  
  const timestamp = now.toLocaleString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  fs.appendFileSync(logFilePath, logMessage, 'utf8');
}

// Função para buscar dados do cliente no Oracle
async function buscarDadosCliente(codcli) {
  let oracleConnection;
  
  try {
    oracleConnection = await oracledb.getConnection({
      user: process.env.LCDBUSER,
      password: process.env.LCDBPASS,
      connectString: `${process.env.LCDBHOST}/${process.env.LCDBNAME}`
    });

    const result = await oracleConnection.execute(
      `SELECT CODCLI, CLIENTE, TELCELENT FROM PCCLIENT WHERE PCCLIENT.CODCLI = :CODCLI`,
      { CODCLI: codcli }
    );

    if (result.rows.length > 0) {
      const [codcli, cliente, telcelent] = result.rows[0];
      return {
        CODCLI: codcli,
        CLIENTE: cliente,
        TELCELENT: telcelent ? String(telcelent).replace(/\D/g, '') : null // Remove caracteres não numéricos
      };
    }
    
    return null;
  } catch (error) {
    writeLog(`Erro ao buscar dados do cliente ${codcli}: ${error.message}`);
    throw error;
  } finally {
    if (oracleConnection) {
      await oracleConnection.close();
    }
  }
}

// FUNÇÃO REMOVIDA: buscarPedidosElegiveis
// Esta função foi removida pois agora utilizamos apenas o MySQL para buscar pedidos elegíveis.
// O Oracle é usado apenas para obter dados de cliente através da função buscarDadosCliente.

// FUNÇÃO REMOVIDA: processarEnviosNPS
// Esta função foi removida pois dependia da função buscarPedidosElegiveis que consultava diretamente o Oracle.
// Agora utilizamos apenas o sistema baseado em MySQL com as funções:
// - buscarNovosPedidosDB: para monitorar novos pedidos no MySQL
// - processarDisparoImediato: para processar disparos imediatos
// - processarPedidoIndividualNPS: para processar pedidos individuais  

// Função para validar se o horário atual está dentro da janela permitida para envio
function validarHorarioEnvio(horarioInicio, horarioFim) {
  try {
    const agora = new Date();
    const horaAtual = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');
    
    // Converter horários para formato comparável (HH:MM)
    const inicioFormatado = horarioInicio ? horarioInicio.substring(0, 5) : '09:00';
    const fimFormatado = horarioFim ? horarioFim.substring(0, 5) : '18:00';
    
    writeLog(`🕐 Validando horário: Atual=${horaAtual}, Permitido=${inicioFormatado}-${fimFormatado}`);
    
    // Comparar horários
    const dentroDoHorario = horaAtual >= inicioFormatado && horaAtual <= fimFormatado;
    
    if (!dentroDoHorario) {
      writeLog(`⏰ Fora do horário de envio: ${horaAtual} não está entre ${inicioFormatado} e ${fimFormatado}`);
    } else {
      writeLog(`✅ Dentro do horário de envio: ${horaAtual}`);
    }
    
    return dentroDoHorario;
  } catch (error) {
    writeLog(`Erro ao validar horário de envio: ${error.message}`);
    // Em caso de erro, permitir envio (comportamento padrão)
    return true;
  }
}

// Função para validar se a campanha está dentro do período ativo (data_inicio e data_fim)
function validarPeriodoCampanha(campanha) {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de data
    
    // Validar data de início
    if (campanha.data_inicio) {
      const dataInicio = new Date(campanha.data_inicio);
      dataInicio.setHours(0, 0, 0, 0);
      
      if (hoje < dataInicio) {
        writeLog(`📅 Campanha "${campanha.nome}" ainda não iniciou. Início: ${campanha.data_inicio}`);
        return {
          ativa: false,
          motivo: `Campanha ainda não iniciou (início: ${campanha.data_inicio})`
        };
      }
    }
    
    // Validar data de fim
    if (campanha.data_fim) {
      const dataFim = new Date(campanha.data_fim);
      dataFim.setHours(23, 59, 59, 999); // Final do dia
      
      if (hoje > dataFim) {
        writeLog(`📅 Campanha "${campanha.nome}" já expirou. Fim: ${campanha.data_fim}`);
        return {
          ativa: false,
          motivo: `Campanha já expirou (fim: ${campanha.data_fim})`
        };
      }
    }
    
    // Se chegou até aqui, a campanha está dentro do período ativo
    const periodoTexto = [];
    if (campanha.data_inicio) periodoTexto.push(`início: ${campanha.data_inicio}`);
    if (campanha.data_fim) periodoTexto.push(`fim: ${campanha.data_fim}`);
    
    const textoCompleto = periodoTexto.length > 0 
      ? ` (${periodoTexto.join(', ')})` 
      : ' (sem limitação de período)';
    
    writeLog(`✅ Campanha "${campanha.nome}" está ativa${textoCompleto}`);
    
    return {
      ativa: true,
      motivo: `Campanha ativa${textoCompleto}`
    };
    
  } catch (error) {
    writeLog(`Erro ao validar período da campanha "${campanha.nome}": ${error.message}`);
    return {
      ativa: false,
      motivo: `Erro na validação: ${error.message}`
    };
  }
}

// Função para gerar token único
function generateUniqueToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Função para enviar mensagem via WhatsApp (implementar conforme sua API)
async function enviarWhatsApp(numero, mensagem, webhookUrl, token) {
  try {
    const response = await axios.post(webhookUrl, {
      number: numero,
      message: mensagem,
      token: token
    });
    
    return {
      success: response.status === 200,
      messageId: response.data?.messageId || `msg_${Date.now()}`
    };
  } catch (error) {
    throw new Error(`Erro ao enviar WhatsApp: ${error.message}`);
  }
}

// Função para gerar múltiplos formatos de busca para números brasileiros
function gerarFormatosBusca(numero) {
  console.log(`🔧 [DEBUG] gerarFormatosBusca chamada com: ${numero}`);
  const formatosBusca = new Set(); // Usar Set para evitar duplicatas
  
  // Adicionar formato original
  formatosBusca.add(numero);
  
  // Remover @c.us para trabalhar com número limpo
  const numeroLimpo = numero.replace('@c.us', '');
  console.log(`🔧 [DEBUG] numeroLimpo: ${numeroLimpo}, tamanho: ${numeroLimpo.length}`);
  formatosBusca.add(numeroLimpo);
  formatosBusca.add(numeroLimpo + '@c.us');
  
  // Se é número brasileiro (começa com 55)
  if (numeroLimpo.startsWith('55')) {
    
    // Caso 1: Número recebido é 559481413567 (12 dígitos)
    // Deve gerar: 5594981413567 (adicionar 9 após DDD)
    if (numeroLimpo.length === 12) {
      console.log(`🔧 [DEBUG] Número de 12 dígitos detectado`);
      const ddd = numeroLimpo.substring(2, 4); // Ex: "94"
      const resto = numeroLimpo.substring(4); // Ex: "81413567"
      const comNono = '55' + ddd + '9' + resto; // 5594981413567
      console.log(`🔧 [DEBUG] Gerando formato com 9: ${comNono}`);
      formatosBusca.add(comNono);
      formatosBusca.add(comNono + '@c.us');
    }
    
    // Caso 2: Número recebido é 5594981413567 (13 dígitos)
    // Deve gerar: 559481413567 (remover 9 após DDD)
    else if (numeroLimpo.length === 13) {
      const ddd = numeroLimpo.substring(2, 4); // Ex: "94"
      const nono = numeroLimpo.substring(4, 5); // Ex: "9"
      const resto = numeroLimpo.substring(5); // Ex: "81413567"
      
      if (nono === '9') {
        const semNono = '55' + ddd + resto; // 559481413567
        formatosBusca.add(semNono);
        formatosBusca.add(semNono + '@c.us');
      }
    }
  }
  // Se não começa com 55, mas tem 10 ou 11 dígitos, adicionar código do país
  else if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
    // Adicionar código do país (55)
    const com55 = '55' + numeroLimpo;
    formatosBusca.add(com55);
    formatosBusca.add(com55 + '@c.us');
    
    // Se tem 10 dígitos, também gerar versão com 9
    if (numeroLimpo.length === 10) {
      const ddd = numeroLimpo.substring(0, 2); // Ex: "94"
      const resto = numeroLimpo.substring(2); // Ex: "81413567"
      const comNono = '55' + ddd + '9' + resto; // 5594981413567
      formatosBusca.add(comNono);
      formatosBusca.add(comNono + '@c.us');
    }
    // Se tem 11 dígitos, também gerar versão sem 9
    else if (numeroLimpo.length === 11) {
      const ddd = numeroLimpo.substring(0, 2); // Ex: "94"
      const nono = numeroLimpo.substring(2, 3); // Ex: "9"
      const resto = numeroLimpo.substring(3); // Ex: "81413567"
      
      if (nono === '9') {
        const semNono = '55' + ddd + resto; // 559481413567
        formatosBusca.add(semNono);
        formatosBusca.add(semNono + '@c.us');
      }
    }
  }
  
  // Converter Set para Array e filtrar valores válidos
  const resultado = Array.from(formatosBusca).filter(f => f && f.length >= 10);
  console.log(`🔧 [DEBUG] Formatos finais gerados: ${resultado.join(', ')}`);
  return resultado;
}

// Função para processar resposta recebida do WhatsApp
async function processarRespostaWhatsApp(numero, instanciaId, mensagem, messageId) {
  try {
    // NOVA ABORDAGEM: Buscar usando múltiplos formatos para números brasileiros
    // O WhatsApp pode alterar o formato do número (adicionar/remover 9 após DDD)
    
    const formatosBusca = gerarFormatosBusca(numero);
    
    console.log(`🔍 Buscando conversa para: ${numero}`);
    console.log(`   Número limpo: ${numero.replace('@c.us', '')}`);
    console.log(`   Formatos de busca (${formatosBusca.length}): ${formatosBusca.join(', ')}`);
    
    // Buscar conversa ativa usando API
    const conversaResponse = await npsAPI.getConversaAtiva(formatosBusca, instanciaId);
    
    if (!conversaResponse.success || !conversaResponse.data) {
      console.log(`❌ Nenhuma conversa ativa encontrada para ${numero}`);
      writeLog(`Nenhuma conversa ativa encontrada para ${numero}`);
      return { success: false, message: 'Conversa não encontrada' };
    }

    const conversa = conversaResponse.data;
    console.log(`✅ Conversa encontrada! ID: ${conversa.id} | Cliente: ${conversa.codcli}`);
    console.log(`   Celular registrado: ${conversa.celular_registrado}`);
    writeLog(`Conversa NPS encontrada para ${numero} - Cliente: ${conversa.codcli}`);
    
    // Processar comandos especiais
    const mensagemLimpa = mensagem.trim().toLowerCase();
    if (mensagemLimpa === '/parar') {
      await finalizarConversa(conversa.id, 'cancelada');
      return { success: true, message: 'Pesquisa cancelada com sucesso.' };
    }
    
    if (mensagemLimpa === '/reiniciar') {
      await reiniciarConversa(conversa.controle_envio_id);
      return { success: true, message: 'Pesquisa reiniciada. Vamos começar novamente!' };
    }

    // Validar e salvar resposta
    const resultadoValidacao = await validarESalvarResposta(
      conversa, 
      mensagem, 
      messageId
    );

    return resultadoValidacao;
    
  } catch (error) {
    writeLog(`Erro ao processar resposta WhatsApp: ${error.message}`);
    throw error;
  }
} 

// Função auxiliar para validar e salvar resposta
async function validarESalvarResposta(conversa, mensagem, messageId) {
  try {
    writeLog(`🔍 Validando resposta: ${mensagem} para pergunta ${conversa.pergunta_atual_id}`);
    
    // Classificar resposta baseada na pergunta atual
    let respostaClassificada = null;
    let proximaPergunta = null;
    let statusConversa = 'ativa';
    
    if (conversa.pergunta_atual_id === 1) {
      // Pergunta NPS (0-10)
      const nota = parseInt(mensagem.trim());
      if (isNaN(nota) || nota < 0 || nota > 10) {
        writeLog(`⚠️  Resposta inválida para NPS: ${mensagem}`);
        return false;
      }
      
      respostaClassificada = {
        controle_envio_id: conversa.controle_envio_id,
        instancia_id: conversa.instancia_id,
        pedido_id: conversa.pedido_id,
        codcli: conversa.codcli,
        campanha_id: conversa.campanha_id,
        pergunta_id: 1,
        resposta: nota,
        nota_nps: nota,
        tipo_resposta: 'numerica',
        categoria_nps: nota >= 9 ? 'promotor' : (nota >= 7 ? 'neutro' : 'detrator'),
        message_id: messageId
      };
      
      proximaPergunta = 2; // Próxima pergunta
      
    } else if (conversa.pergunta_atual_id === 2) {
      // Pergunta de feedback textual
      respostaClassificada = {
        controle_envio_id: conversa.controle_envio_id,
        instancia_id: conversa.instancia_id,
        pedido_id: conversa.pedido_id,
        codcli: conversa.codcli,
        campanha_id: conversa.campanha_id,
        pergunta_id: 2,
        resposta: mensagem,
        tipo_resposta: 'textual',
        message_id: messageId
      };
      
      statusConversa = 'finalizada';
    }
    
    if (respostaClassificada) {
      // Salvar resposta usando a API
      writeLog(`💾 Salvando resposta: ${JSON.stringify(respostaClassificada)}`);
      await npsAPI.saveRespostaNPS(respostaClassificada);
      
      // Atualizar estado da conversa usando a API
      if (proximaPergunta) {
        writeLog(`➡️  Avançando para pergunta ${proximaPergunta}`);
        await npsAPI.updateEstadoConversa(conversa.id, {
          pergunta_atual_id: proximaPergunta,
          aguardando_resposta: true
        });
      } else {
        writeLog(`🏁 Finalizando conversa`);
        await npsAPI.updateEstadoConversa(conversa.id, {
          status: statusConversa,
          aguardando_resposta: false
        });
      }
      
      return true;
    }
    
    return false;
    
  } catch (error) {
    writeLog(`❌ Erro ao validar e salvar resposta: ${error.message}`);
    throw error;
  }
}

// Função auxiliar para finalizar conversa
async function finalizarConversa(estadoConversaId, status) {
  try {
    // Atualizar estado da conversa usando a API
    await npsAPI.updateEstadoConversa(estadoConversaId, {
      status: status,
      aguardando_resposta: false
    });
    
    writeLog(`Conversa finalizada com status: ${status} (ID: ${estadoConversaId})`);
    
  } catch (error) {
    writeLog(`Erro ao finalizar conversa ${estadoConversaId}: ${error.message}`);
    throw error;
  }
}

// Função para buscar novos pedidos do MySQL em tempo real (APENAS pedidos recém-criados)
async function buscarNovosPedidosDB() {
  try {
    writeLog('🔍 Monitorando novos pedidos MySQL para NPS individual...');
    console.log('🎯 Verificando campanhas NPS ativas com disparo imediato...');
    
    // Buscar campanhas ativas com disparo imediato usando a API
    const campanhas = await npsAPI.getCampanhasAtivas(1); // disparo_imediato = 1
    
    console.log(`📋 Campanhas encontradas: ${campanhas.length}`);
    if (campanhas.length === 0) {
      console.log('⚠️  Nenhuma campanha NPS com disparo imediato encontrada');
      writeLog('ℹ️  Nenhuma campanha NPS com disparo imediato encontrada');
      return [];
    }
    
    console.log(`🎯 Encontradas ${campanhas.length} campanhas com disparo imediato`);
    const pedidosElegiveis = [];
    
    // Para cada campanha ativa, buscar APENAS pedidos muito recentes (5 minutos)
    for (const campanha of campanhas) {
      // Validar se a campanha está dentro do período ativo (data_inicio e data_fim)
      const validacaoPeriodo = validarPeriodoCampanha(campanha);
      
      if (!validacaoPeriodo.ativa) {
        console.log(`⏭️  Pulando campanha "${campanha.nome}": ${validacaoPeriodo.motivo}`);
        writeLog(`⏭️  Campanha "${campanha.nome}" pulada: ${validacaoPeriodo.motivo}`);
        continue;
      }
      
      console.log(`✅ Campanha "${campanha.nome}" está ativa e será processada`);
      
      // Buscar pedidos recentes usando a API
      const pedidos = await npsAPI.getPedidosRecentes({
        minutos: 5,
        filiais: campanha.filiais_ativas,
        limit: 10
      });
      
      console.log(`📋 Campanha "${campanha.nome}": ${pedidos.length} pedidos recentes encontrados`);
      writeLog(`📋 Campanha "${campanha.nome}": ${pedidos.length} pedidos recentes encontrados`);
      
      // Processar cada pedido e extrair informações do cliente
      for (const pedido of pedidos) {
        try {
          console.log(`   🔍 Verificando pedido ${pedido.NUMPED} (Filial: ${pedido.CODFILIAL})`);
          
          // Extrair informações do cliente dos itens (JSON) ANTES de verificar controle
          let clienteInfo = null;
          
          if (pedido.itens) {
            try {
              const itens = JSON.parse(pedido.itens);
              
              // Buscar o primeiro item com informações válidas de cliente
              for (const item of itens) {
                // Verificar tanto CODCLI (maiúsculo) quanto codcli (minúsculo)
                const codcli = item.CODCLI || item.codcli;
                
                if (codcli && codcli !== 1) {
                  // Buscar dados do cliente na tabela PCCLIENT do Oracle
                  try {
                    const clienteOracle = await buscarDadosCliente(codcli);
                    
                    if (clienteOracle && clienteOracle.TELCELENT) {
                      clienteInfo = {
                        codcli: codcli,
                        nome: clienteOracle.CLIENTE || `Cliente ${codcli}`,
                        telefone: clienteOracle.TELCELENT
                      };
                      break;
                    }
                  } catch (error) {
                    console.error(`      ❌ Erro ao buscar cliente ${codcli} no Oracle: ${error.message}`);
                  }
                }
              }
            } catch (e) {
              writeLog(`Erro ao processar itens do pedido ${pedido.NUMPED}: ${e.message}`);
            }
          }
          
          // Se encontrou cliente válido, adicionar à lista
          if (clienteInfo && clienteInfo.telefone && clienteInfo.telefone.trim() !== '') {
            const telefone = clienteInfo.telefone.replace(/\D/g, '');
            
            if (telefone.length >= 10) {
              console.log(`      ✅ ${clienteInfo.nome} elegível para NPS`);
              
              pedidosElegiveis.push({
                NUMPED: pedido.NUMPED,
                CODCLI: clienteInfo.codcli,
                CODFILIAL: pedido.CODFILIAL,
                NUMCAIXA: pedido.NUMCAIXA,
                DATA: pedido.DATA,
                VLTOTAL: pedido.VLTOTAL || 0,
                CLIENTE: clienteInfo.nome,
                TELCELENT: telefone,
                campanha_id: campanha.id,
                instancia_id: campanha.instancia_id,
                dias_apos_compra: campanha.dias_apos_compra,
                disparo_imediato: campanha.disparo_imediato
              });
              
              writeLog(`✅ Pedido ${pedido.NUMPED} elegível para NPS (Cliente: ${clienteInfo.nome})`);
            } else {
              console.log(`      ❌ Cliente NÃO elegível: telefone inválido (${telefone.length} dígitos)`);
            }
          } else {
            console.log(`      ⚠️  Nenhum cliente válido encontrado nos itens do pedido`);
          }
        } catch (error) {
          console.error(`      ❌ Erro ao processar pedido ${pedido.NUMPED}: ${error.message}`);
          writeLog(`Erro ao processar pedido ${pedido.NUMPED}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n🎆 Resumo da busca:`);
    console.log(`   📊 Total de pedidos elegíveis para NPS: ${pedidosElegiveis.length}`);
    if (pedidosElegiveis.length > 0) {
      console.log(`   📦 Pedidos que serão processados:`);
      pedidosElegiveis.forEach((p, i) => {
        console.log(`      ${i + 1}. Pedido ${p.NUMPED} - ${p.CLIENTE} (${p.TELCELENT})`);
      });
    }
    
    writeLog(`🎆 Total de pedidos elegíveis para NPS: ${pedidosElegiveis.length}`);
    return pedidosElegiveis;
    
  } catch (error) {
    console.error('❌ Erro crítico ao buscar novos pedidos:', error.message);
    writeLog('Erro ao buscar novos pedidos: ' + error.message);
    throw error;
  }
}

// Função para processar resposta recebida do WhatsApp
async function processarRespostaWhatsApp(numero, instanciaId, mensagem, messageId) {
  try {
    writeLog(`📱 Processando resposta WhatsApp: ${numero} | Instância: ${instanciaId} | Mensagem: ${mensagem}`);
    
    // Gerar formatos de busca para o número
    const formatosBusca = gerarFormatosBusca(numero);
    
    // Buscar conversa ativa usando a API
    const conversa = await npsAPI.getConversaAtiva(formatosBusca, instanciaId);

    if (!conversa) {
      writeLog(`⚠️  Nenhuma conversa ativa encontrada para ${numero} na instância ${instanciaId}`);
      return false;
    }

    writeLog(`✅ Conversa encontrada: ID ${conversa.id}, Pergunta atual: ${conversa.pergunta_atual_id}`);

    // Processar comandos especiais
    const mensagemLimpa = mensagem.trim().toLowerCase();
    if (mensagemLimpa === '/parar') {
      await finalizarConversa(conversa.id, 'cancelada');
      return { success: true, message: 'Pesquisa cancelada com sucesso.' };
    }
    
    if (mensagemLimpa === '/reiniciar') {
      await reiniciarConversa(conversa.controle_envio_id);
      return { success: true, message: 'Pesquisa reiniciada. Vamos começar novamente!' };
    }

    // Processar resposta baseada na pergunta atual
    return await validarESalvarResposta(conversa, mensagem, messageId);
    
  } catch (error) {
    writeLog(`❌ Erro ao processar resposta WhatsApp: ${error.message}`);
    throw error;
  }
}

// Função auxiliar para reiniciar conversa
async function reiniciarConversa(controleEnvioId) {
  try {
    // Atualizar estado da conversa usando a API
    await npsAPI.updateEstadoConversa(controleEnvioId, {
      pergunta_atual_id: 1,
      aguardando_resposta: true
    });
    
    writeLog(`Conversa reiniciada para controle ${controleEnvioId}`);
    
  } catch (error) {
    writeLog(`Erro ao reiniciar conversa ${controleEnvioId}: ${error.message}`);
    throw error;
  }
}

// Função para processar envios NPS agendados por horário
async function processarEnviosAgendadosHorario() {
  try {
    writeLog('🕐 Processando envios NPS agendados por horário...');
    
    // Buscar envios agendados usando a API
    const enviosAgendados = await npsAPI.getEnviosAgendados();
    
    if (enviosAgendados.length === 0) {
      writeLog('ℹ️  Nenhum envio NPS agendado por horário encontrado');
      return;
    }
    
    writeLog(`📋 Encontrados ${enviosAgendados.length} envios agendados por horário`);
    
    for (const envio of enviosAgendados) {
      try {
        // Buscar dados da campanha para validar período
        let campanhaValida = true;
        let motivoInvalida = '';
        
        if (envio.campanha_id) {
          try {
            const campanha = await npsAPI.getCampanha(envio.campanha_id);
            if (campanha) {
              const validacaoPeriodo = validarPeriodoCampanha(campanha);
              if (!validacaoPeriodo.ativa) {
                campanhaValida = false;
                motivoInvalida = validacaoPeriodo.motivo;
                writeLog(`⏭️  Envio ${envio.id} pulado: ${motivoInvalida}`);
              }
            }
          } catch (error) {
            writeLog(`Erro ao validar campanha do envio ${envio.id}: ${error.message}`);
          }
        }
        
        // Só processar se a campanha estiver válida
        if (!campanhaValida) {
          // Marcar envio como cancelado por período inválido
          await npsAPI.updateControleEnvio(envio.id, {
            status_envio: 'cancelado',
            ultimo_erro: motivoInvalida
          });
          continue;
        }
        
        // Validar se agora está dentro do horário permitido
        if (validarHorarioEnvio(envio.horario_envio_inicio, envio.horario_envio_fim)) {
          // Processar envio usando a API
          await npsAPI.updateControleEnvio(envio.id, {
            status_envio: 'processado',
            data_processamento: new Date().toISOString()
          });
          
          writeLog(`✅ Envio agendado processado: ${envio.id}`);
        } else {
          // Reagendar para próximo dia usando a API
          const proximaData = new Date();
          proximaData.setDate(proximaData.getDate() + 1);
          
          await npsAPI.updateControleEnvio(envio.id, {
            data_elegivel: proximaData.toISOString()
          });
          
          writeLog(`📅 Reagendado para próximo dia: ${envio.id}`);
        }
      } catch (error) {
        writeLog(`Erro ao processar envio agendado ${envio.id}: ${error.message}`);
        
        // Marcar como erro usando a API
        await npsAPI.updateControleEnvio(envio.id, {
          status_envio: 'erro',
          ultimo_erro: error.message
        });
      }
    }
    
  } catch (error) {
    writeLog(`Erro ao processar envios agendados por horário: ${error.message}`);
    throw error;
  }
}

// Função para processar disparo imediato de NPS para pedidos individuais
async function processarDisparoImediato() {
  try {
    const inicioProcessamento = new Date();
    writeLog('🚀 Iniciando processamento de disparo imediato de NPS...');
    console.log(`[${inicioProcessamento.toLocaleTimeString('pt-BR')}] 🔍 Iniciando verificação de novos pedidos NPS`);
    
    // Buscar novos pedidos que precisam de NPS usando a API
    console.log('🔎 Buscando novos pedidos elegíveis para NPS...');
    const novosPedidos = await buscarNovosPedidosDB();
    
    if (novosPedidos.length === 0) {
      console.log('ℹ️  Nenhum novo pedido encontrado para disparo imediato.');
      writeLog('ℹ️  Nenhum novo pedido encontrado para disparo imediato.');
      return;
    }
    
    console.log(`📦 Encontrados ${novosPedidos.length} pedidos elegíveis para NPS`);
    writeLog(`📦 Encontrados ${novosPedidos.length} pedidos individuais para disparo de NPS`);
    
    // Processar cada pedido individualmente
    let processadosComSucesso = 0;
    let errosProcessamento = 0;
    
    for (const pedido of novosPedidos) {
      try {
        console.log(`⚡ [${processadosComSucesso + 1}/${novosPedidos.length}] Processando pedido ${pedido.NUMPED} (Cliente: ${pedido.CLIENTE})`);
        writeLog(`⚡ Processando pedido individual: ${pedido.NUMPED} para cliente ${pedido.CODCLI}`);
        await processarPedidoIndividualNPS(pedido);
        processadosComSucesso++;
        console.log(`✅ Pedido ${pedido.NUMPED} processado com sucesso`);
      } catch (error) {
        // Verificar se é erro 409 (controle já cadastrado) - não exibir como erro
        if (error.message && (error.message.includes('409') || error.message.includes('já existe') || error.message.includes('duplicat'))) {
          console.log(`ℹ️  Pedido ${pedido.NUMPED} já foi processado anteriormente`);
          writeLog(`ℹ️  Pedido ${pedido.NUMPED} já processado para cliente ${pedido.CODCLI}`);
          processadosComSucesso++; // Contar como sucesso pois já foi processado
        } else {
          errosProcessamento++;
          console.error(`❌ Erro ao processar pedido ${pedido.NUMPED}: ${error.message}`);
          writeLog(`❌ Erro ao processar pedido ${pedido.NUMPED} para cliente ${pedido.CODCLI}: ${error.message}`);
        }
      }
    }
    
    const fimProcessamento = new Date();
    const tempoProcessamento = fimProcessamento - inicioProcessamento;
    
    console.log(`\n📊 Resumo do processamento:`);
    console.log(`   ✅ Processados com sucesso: ${processadosComSucesso}`);
    console.log(`   ❌ Erros: ${errosProcessamento}`);
    console.log(`   ⏱️  Tempo total: ${tempoProcessamento}ms`);
    console.log(`[${fimProcessamento.toLocaleTimeString('pt-BR')}] 🏁 Verificação concluída\n`);
    
    writeLog('✅ Processamento de disparo imediato concluído.');
    
  } catch (error) {
    console.error('❌ Erro crítico no processamento de disparo imediato:', error.message);
    writeLog('❌ Erro no processamento de disparo imediato: ' + error.message);
    throw error;
  }
}

// Função para monitoramento contínuo em tempo real
async function iniciarMonitoramentoContinuo() {
  // Obter intervalo de monitoramento do .env (padrão: 120000ms = 2 minutos)
  const intervalMs = parseInt(process.env.NPS_MONITOR_INTERVAL_MS) || 120000;
  const intervalSegundos = Math.round(intervalMs / 1000);
  const intervalTexto = intervalSegundos >= 60 
    ? `${Math.round(intervalSegundos / 60)} minuto(s)`
    : `${intervalSegundos} segundo(s)`;
  
  writeLog('🔄 Iniciando monitoramento contínuo de pedidos NPS...');
  writeLog(`⏰ Verificando novos pedidos a cada ${intervalTexto} (${intervalMs}ms)`);
  writeLog('🛑 Para parar, pressione Ctrl+C');
  writeLog('💡 Configure NPS_MONITOR_INTERVAL_MS no .env para alterar o intervalo');
  
  // Executar imediatamente na primeira vez
  await processarDisparoImediato();
  
  // Configurar intervalo baseado na variável de ambiente
  setInterval(async () => {
    try {
      const agora = new Date().toLocaleString('pt-BR');
      writeLog(`\n⏰ [${agora}] Verificando novos pedidos...`);
      await processarDisparoImediato();
    } catch (error) {
      writeLog(`❌ Erro no monitoramento contínuo: ${error.message}`);
    }
  }, intervalMs);
  
  // Manter o processo vivo
  process.on('SIGINT', () => {
    writeLog('\n🛑 Monitoramento interrompido pelo usuário');
    process.exit(0);
  });
}

// Função para garantir que o estado de conversa NPS existe
async function garantirEstadoConversa(controleId, pedido, dadosCampanha) {
  try {
    console.log(`🔍 Verificando estado de conversa para controle ID ${controleId}`);
    console.log(`   Cliente: ${pedido.CLIENTE}`);
    console.log(`   Pedido: ${pedido.NUMPED}`);
    console.log(`   Instância ID: ${pedido.instancia_id}`);
    
    // PRIMEIRO: Buscar o controle de envio para obter o formato correto do número
    let numeroParaBusca;
    let instanciaCorreta;
    
    try {
      const controleEnvio = await npsAPI.buscarControleEnvio(pedido.NUMPED, pedido.campanha_id);
      
      if (controleEnvio && controleEnvio.controle) {
        // Usar o número exatamente como está salvo no controle
        const celularControle = controleEnvio.controle.celular;
        instanciaCorreta = controleEnvio.controle.instancia_id;
        
        // Gerar múltiplos formatos para busca (baseado na memória de soluções anteriores)
        const formatosPossíveis = [
          celularControle,                           // Formato original do controle
          celularControle + '@c.us',                // Adicionar @c.us
          '55' + celularControle,                   // Adicionar código do país
          '55' + celularControle + '@c.us',         // Código país + @c.us
        ];
        
        // Se o número não tem código do país, tentar variações
        if (!celularControle.startsWith('55')) {
          formatosPossíveis.push('55' + celularControle);
          formatosPossíveis.push('55' + celularControle + '@c.us');
        }
        
        numeroParaBusca = formatosPossíveis;
        
        console.log(`📋 Controle encontrado:`);
        console.log(`   Celular no controle: ${celularControle}`);
        console.log(`   Instância no controle: ${instanciaCorreta}`);
        console.log(`   Formatos para busca: ${formatosPossíveis.join(', ')}`);
        
      } else {
        console.log(`⚠️ Controle de envio não encontrado, usando formato padrão`);
        const telefone = formatarTelefone(pedido.TELCELENT);
        numeroParaBusca = [formatarParaWhatsApp(telefone)];
        instanciaCorreta = pedido.instancia_id;
      }
    } catch (controleError) {
      console.log(`⚠️ Erro ao buscar controle de envio: ${controleError.message}`);
      const telefone = formatarTelefone(pedido.TELCELENT);
      numeroParaBusca = [formatarParaWhatsApp(telefone)];
      instanciaCorreta = pedido.instancia_id;
    }
    
    // Verificar se já existe uma conversa ativa usando os formatos corretos
    try {
      const conversaExistente = await npsAPI.getConversaAtiva(numeroParaBusca, instanciaCorreta);
      
      if (conversaExistente) {
        console.log(`ℹ️ Estado de conversa já existe para ${pedido.CLIENTE} (ID: ${conversaExistente.id})`);
        console.log(`   Celular encontrado: ${conversaExistente.celular}`);
        writeLog(`Estado de conversa já existe para pedido ${pedido.NUMPED} - ID: ${conversaExistente.id}`);
        return true;
      }
    } catch (conversaError) {
      console.log(`⚠️ Erro ao verificar conversa existente: ${conversaError.message}`);
      // Continuar tentando criar mesmo se a verificação falhar
    }
    
    console.log(`📝 Criando novo estado de conversa para ${pedido.CLIENTE}`);
    
    const dataTimeout = new Date();
    dataTimeout.setMinutes(dataTimeout.getMinutes() + (dadosCampanha.timeout_conversa_minutos || 60));
    
    // Determinar o formato correto do número para salvar
    let numeroParaSalvar;
    
    if (numeroParaBusca && numeroParaBusca.length > 0) {
      // Usar o primeiro formato da lista (formato original do controle)
      numeroParaSalvar = numeroParaBusca[0];
      
      // Se não tem @c.us, adicionar para manter consistência com WhatsApp
      if (!numeroParaSalvar.includes('@c.us')) {
        // Se já tem código do país (55), usar direto
        if (numeroParaSalvar.startsWith('55')) {
          numeroParaSalvar = numeroParaSalvar + '@c.us';
        } else {
          // Adicionar código do país + @c.us
          numeroParaSalvar = '55' + numeroParaSalvar + '@c.us';
        }
      }
    } else {
      // Fallback para formato padrão
      const telefone = formatarTelefone(pedido.TELCELENT);
      numeroParaSalvar = formatarParaWhatsApp(telefone);
    }
    
    console.log(`📱 Número que será salvo no estado: ${numeroParaSalvar}`);
    
    const estadoData = {
      controle_envio_id: controleId,
      instancia_id: instanciaCorreta || pedido.instancia_id,
      celular: numeroParaSalvar,
      pergunta_atual_id: null,  // NULL em vez de 0 para evitar constraint violation
      ordem_resposta: 0,
      aguardando_resposta: true,
      proxima_acao: 'pergunta_principal',
      data_timeout: dataTimeout.toISOString().slice(0, 19).replace('T', ' ')
    };
    
    console.log(`📋 Dados do estado de conversa:`, JSON.stringify(estadoData, null, 2));
    
    try {
      const resultado = await npsAPI.createEstadoConversa(estadoData);
      
      console.log(`📤 Resposta da API:`, JSON.stringify(resultado, null, 2));
      
      if (resultado && resultado.success) {
        console.log(`✅ Estado de conversa criado com sucesso para ${pedido.CLIENTE} (ID: ${resultado.id})`);
        writeLog(`Estado de conversa criado para pedido ${pedido.NUMPED} com controle ID ${controleId} - Novo ID: ${resultado.id}`);
        return true;
      } else {
        const errorMsg = resultado?.message || resultado?.error || 'Resposta inválida da API';
        console.log(`❌ Falha ao criar estado de conversa: ${errorMsg}`);
        writeLog(`Erro ao criar estado de conversa para pedido ${pedido.NUMPED}: ${errorMsg}`);
        return false;
      }
    } catch (createError) {
      console.log(`❌ Erro na API ao criar estado de conversa: ${createError.message}`);
      
      // Verificar se é erro de constraint única (já existe)
      if (createError.message.includes('Duplicate entry') || 
          createError.message.includes('unique_conversa') ||
          createError.message.includes('já existe')) {
        console.log(`ℹ️ Estado de conversa já existe (constraint única) para controle ID ${controleId}`);
        writeLog(`Estado de conversa já existe para pedido ${pedido.NUMPED} - constraint única`);
        return true; // Considerar como sucesso se já existe
      }
      
      writeLog(`Erro crítico ao criar estado de conversa para pedido ${pedido.NUMPED}: ${createError.message}`);
      throw createError; // Re-throw para captura no catch externo
    }
    
  } catch (error) {
    console.log(`❌ Erro geral ao verificar/criar estado de conversa: ${error.message}`);
    console.log(`   Stack trace:`, error.stack);
    writeLog(`Erro geral ao verificar/criar estado de conversa para pedido ${pedido.NUMPED}: ${error.message}`);
    return false;
  }
}

// Função para processar um pedido individual para NPS (novo sistema - um registro por pedido)
async function processarPedidoIndividualNPS(pedido) {
  try {
    // Validar telefone
    if (!pedido.TELCELENT || pedido.TELCELENT.trim() === '') {
      writeLog(`Cliente ${pedido.CODCLI} não possui telefone cadastrado`);
      return;
    }
    
    // Formatar telefone
    const telefone = formatarTelefone(pedido.TELCELENT);
    if (!telefone) {
      writeLog(`Telefone inválido para cliente ${pedido.CODCLI}: ${pedido.TELCELENT}`);
      return;
    }
    
    // Buscar dados da campanha usando a API
    const dadosCampanha = await npsAPI.getCampanhaPorId(pedido.campanha_id);
    
    if (!dadosCampanha) {
      writeLog(`Campanha ${pedido.campanha_id} não encontrada ou inativa`);
      return;
    }
    
    // VALIDAR NÚMERO WHATSAPP ANTES DE CRIAR CONTROLE DE ENVIO
    console.log(`🔍 Validando número WhatsApp ${telefone} antes de criar controle...`);
    
    // Formatar número para WhatsApp
    const numeroWhatsApp = formatarParaWhatsApp(telefone);
    
    try {
      const validationResponse = await axios.post(`${process.env.API_LOCAL_WHATSAPP}/api/instances/${pedido.instancia_id}/validate-number`, {
        number: numeroWhatsApp
      });
      
      if (!validationResponse.data.success || !validationResponse.data.hasWhatsApp) {
        const motivo = validationResponse.data.error || 'Número não possui conta WhatsApp';
        console.log(`❌ Número ${numeroWhatsApp} não possui conta WhatsApp: ${motivo}`);
        writeLog(`Número ${numeroWhatsApp} não possui conta WhatsApp - Pedido ${pedido.NUMPED}: ${motivo}`);
        writeLog(`❌ Pedido ${pedido.NUMPED} (Cliente: ${pedido.CLIENTE}) não processado - número sem WhatsApp`);
        return; // Não criar controle de envio
      }
      
      console.log(`✅ Número ${numeroWhatsApp} possui conta WhatsApp - prosseguindo`);
      
    } catch (validationError) {
      console.log(`⚠️ Erro ao validar número ${numeroWhatsApp}: ${validationError.message}`);
      
      // Se o erro contém indicação de número inválido, não prosseguir
      if (validationError.response && validationError.response.status === 400 && 
          validationError.response.data && !validationError.response.data.hasWhatsApp) {
        console.log(`❌ Validação confirmou que número não possui WhatsApp - não criando controle`);
        writeLog(`Número ${numeroWhatsApp} não possui conta WhatsApp - Pedido ${pedido.NUMPED} não processado`);
        return; // Não criar controle de envio
      }
      
      console.log(`   Prosseguindo (assumindo que número é válido)...`);
      writeLog(`Erro na validação do número ${numeroWhatsApp} - Pedido ${pedido.NUMPED}: ${validationError.message}`);
    }
    
    // Criar controle de envio usando a API (apenas se número for válido)
    const controleData = {
      campanha_id: pedido.campanha_id,
      instancia_id: pedido.instancia_id,
      pedido_id: pedido.NUMPED,
      numero_pedido: pedido.NUMPED,
      codcli: pedido.CODCLI,
      celular: telefone,
      nome_cliente: pedido.CLIENTE,
      filial: pedido.CODFILIAL,
      caixa: pedido.NUMCAIXA,
      valor_pedido: pedido.VLTOTAL,
      status_envio: 'pendente'
    };
    
    const controleResult = await npsAPI.createControleEnvio(controleData);
    
    let controleId;
    let controleJaExistia = false;
    
    if (controleResult.exists) {
      writeLog(`Controle de envio já existe para pedido ${pedido.NUMPED}, cliente ${pedido.CODCLI}`);
      controleJaExistia = true;
      
      // Buscar o ID do controle existente
      const controleExistente = await npsAPI.buscarControleEnvio(pedido.NUMPED, pedido.campanha_id);
      if (controleExistente && controleExistente.controle) {
        controleId = controleExistente.controle.id;
        writeLog(`ID do controle existente: ${controleId}`);
      } else {
        writeLog(`❌ Não foi possível obter ID do controle existente para pedido ${pedido.NUMPED}`);
        return;
      }
    } else {
      controleId = controleResult.id;
      writeLog(`Novo controle criado com ID: ${controleId}`);
    }
    
    // SEMPRE criar o estado de conversa primeiro (independente do envio)
    console.log(`🔗 Criando estado de conversa para pedido ${pedido.NUMPED} antes do envio...`);
    const estadoCriado = await garantirEstadoConversa(controleId, pedido, dadosCampanha);
    
    if (estadoCriado) {
      writeLog(`✅ Estado de conversa criado para pedido ${pedido.NUMPED} (Cliente: ${pedido.CLIENTE})`);
    } else {
      writeLog(`⚠️ Falha ao criar estado de conversa para pedido ${pedido.NUMPED}`);
    }
    
    // Verificar se deve enviar mensagem (controle novo OU controle existente com status que permite reenvio)
    let deveEnviarMensagem = !controleJaExistia;
    
    // Se controle já existia, verificar se pode reenviar baseado no status
    if (controleJaExistia) {
      const controleExistente = await npsAPI.buscarControleEnvioPorId(controleId);
      if (controleExistente && controleExistente.controle) {
        const statusAtual = controleExistente.controle.status_envio;
        // Permitir reenvio se status for: pendente, erro, falha, ou agendado
        const statusPermiteReenvio = ['pendente', 'erro', 'falha', 'agendado', 'agendado_horario'];
        if (statusPermiteReenvio.includes(statusAtual)) {
          deveEnviarMensagem = true;
          writeLog(`🔄 Controle existente com status '${statusAtual}' permite reenvio para pedido ${pedido.NUMPED}`);
        } else {
          writeLog(`⏭️ Controle existente com status '${statusAtual}' não permite reenvio para pedido ${pedido.NUMPED}`);
        }
      }
    }
    
    if (deveEnviarMensagem) {
      // Se for disparo imediato (dias_apos_compra = 0), verificar horário e enviar agora
      if (dadosCampanha.dias_apos_compra === 0 || dadosCampanha.disparo_imediato) {
        // Validar horário de envio antes de enviar
        if (validarHorarioEnvio(dadosCampanha.horario_envio_inicio, dadosCampanha.horario_envio_fim)) {
          try {
            await enviarMensagemNPSIndividual(controleId, pedido, dadosCampanha);
            writeLog(`📱 Mensagem NPS enviada imediatamente para pedido ${pedido.NUMPED}`);
          } catch (envioError) {
            writeLog(`❌ Erro ao enviar mensagem NPS para pedido ${pedido.NUMPED}: ${envioError.message}`);
            // Estado de conversa já foi criado, então continuar mesmo com erro de envio
          }
        } else {
          // Fora do horário - agendar para próximo horário válido
          const proximaData = new Date();
          proximaData.setDate(proximaData.getDate() + 1);
          
          await npsAPI.updateControleEnvio(controleId, {
            data_elegivel: proximaData.toISOString(),
            status_envio: 'agendado_horario'
          });
          
          writeLog(`📅 Pedido ${pedido.NUMPED} agendado para próximo horário válido (estado de conversa já criado)`);
        }
      } else {
        // Agendar para envio futuro
        const dataElegivel = new Date(pedido.DATA);
        dataElegivel.setDate(dataElegivel.getDate() + dadosCampanha.dias_apos_compra);
        
        await npsAPI.updateControleEnvio(controleId, {
          data_elegivel: dataElegivel.toISOString()
        });
        
        writeLog(`Pedido ${pedido.NUMPED} agendado para envio em ${dadosCampanha.dias_apos_compra} dias (estado de conversa já criado)`);
      }
    } else {
      writeLog(`⏭️ Controle já existia para pedido ${pedido.NUMPED} - apenas garantindo estado de conversa (sem reenvio)`);
    }
    
    writeLog(`✅ Pedido ${pedido.NUMPED} processado com sucesso para NPS (Cliente: ${pedido.CLIENTE})`);
    
    // Verificação final adicional (redundante, mas garante integridade)
    try {
      await garantirEstadoConversa(controleId, pedido, dadosCampanha);
    } catch (finalError) {
      writeLog(`⚠️ Verificação final do estado de conversa falhou para pedido ${pedido.NUMPED}: ${finalError.message}`);
    }
    
  } catch (error) {
    writeLog(`Erro ao processar pedido individual ${pedido.NUMPED}: ${error.message}`);
    throw error;
  }
}

// Função para processar um pedido específico para NPS (sistema antigo - mantido para compatibilidade)
async function processarPedidoParaNPS(pedido) {
  try {
    // Validar telefone
    if (!pedido.TELCELENT || pedido.TELCELENT.trim() === '') {
      writeLog(`Cliente ${pedido.CODCLI} não possui telefone cadastrado`);
      return;
    }
    
    // Formatar telefone
    const telefone = formatarTelefone(pedido.TELCELENT);
    if (!telefone) {
      writeLog(`Telefone inválido para cliente ${pedido.CODCLI}: ${pedido.TELCELENT}`);
      return;
    }
    
    // Buscar dados da campanha usando a API
    const dadosCampanha = await npsAPI.getCampanhaPorId(pedido.campanha_id);
    
    if (!dadosCampanha) {
      writeLog(`Campanha ${pedido.campanha_id} não encontrada ou inativa`);
      return;
    }
    
    // Criar controle de envio usando a API
    const controleData = {
      campanha_id: pedido.campanha_id,
      instancia_id: pedido.instancia_id,
      pedido_id: pedido.NUMPED,
      numero_pedido: pedido.NUMPED,
      codcli: pedido.CODCLI,
      celular: telefone,
      nome_cliente: pedido.CLIENTE,
      filial: pedido.CODFILIAL || null,
      caixa: pedido.NUMCAIXA || null,
      valor_pedido: pedido.VLTOTAL,
      status_envio: 'pendente'
    };
    
    const controleResult = await npsAPI.createControleEnvio(controleData);
    
    if (controleResult.exists) {
      writeLog(`Controle de envio já existe para pedido ${pedido.NUMPED}, cliente ${pedido.CODCLI}`);
      return;
    }
    
    // Enviar mensagem NPS usando a API
    await enviarMensagemNPSIndividual(controleResult.id, pedido, dadosCampanha);
    
  } catch (error) {
    writeLog(`Erro ao processar pedido individual ${pedido.NUMPED}: ${error.message}`);
    throw error;
  }
}

// Função para enviar mensagem NPS individual
async function enviarMensagemNPSIndividual(controleId, pedido, dadosCampanha) {
  try {
    // Personalizar mensagem inicial com dados do pedido e cliente
    const mensagemInicial = dadosCampanha.mensagem_inicial
      .replace('{cliente}', pedido.CLIENTE)
      .replace('{pedido}', pedido.NUMPED)
      .replace('{valor}', formatarValor(pedido.VLTOTAL))
      .replace('{data}', new Date(pedido.DATA).toLocaleDateString('pt-BR'));
    
    // Personalizar pergunta principal
    const perguntaPrincipal = dadosCampanha.pergunta_principal
      .replace('{cliente}', pedido.CLIENTE)
      .replace('{pedido}', pedido.NUMPED);
    
    // Combinar mensagem inicial + pergunta principal
    const mensagemCompleta = `${mensagemInicial}\n\n${perguntaPrincipal}`;
    
    writeLog(`Enviando NPS completo para cliente ${pedido.CLIENTE} (${pedido.CODCLI}) - Pedido: ${pedido.NUMPED}`);
    console.log(`📱 Enviando mensagem NPS completa (inicial + pergunta) para ${pedido.CLIENTE}`);
    
    // Formatar número para envio
    const numeroFormatado = formatarTelefone(pedido.TELCELENT);
    const numeroWhatsApp = formatarParaWhatsApp(numeroFormatado);
    
    console.log(`📱 Formatação de número:`);
    console.log(`   Original: ${pedido.TELCELENT}`);
    console.log(`   Para envio WhatsApp: ${numeroWhatsApp}`);
    
    // Validar se o número possui conta WhatsApp antes de enviar
    console.log(`🔍 Validando se o número ${numeroWhatsApp} possui conta WhatsApp...`);
    
    try {
      const validationResponse = await axios.post(`${process.env.API_LOCAL_WHATSAPP}/api/instances/${pedido.instancia_id}/validate-number`, {
        number: numeroWhatsApp
      });
      
      if (!validationResponse.data.success || !validationResponse.data.hasWhatsApp) {
        const motivo = validationResponse.data.error || 'Número não possui conta WhatsApp';
        console.log(`❌ Número ${numeroWhatsApp} não possui conta WhatsApp: ${motivo}`);
        writeLog(`Número ${numeroWhatsApp} não possui conta WhatsApp - Controle ${controleId}: ${motivo}`);
        
        // Atualizar status do controle para 'numero_invalido'
        await npsAPI.atualizarControleEnvio(controleId, {
          status_envio: 'numero_invalido',
          data_envio: new Date().toISOString().slice(0, 19).replace('T', ' '),
          ultimo_erro: `Número não possui conta WhatsApp: ${motivo}`
        });
        
        console.log(`❌ Envio cancelado - número ${numeroWhatsApp} não possui conta WhatsApp`);
        return {
          success: false,
          message: `Número ${numeroWhatsApp} não possui conta WhatsApp`,
          controleId: controleId,
          numeroValidado: false
        };
      }
      
      console.log(`✅ Número ${numeroWhatsApp} possui conta WhatsApp - prosseguindo com envio`);
      console.log(`   Número formatado: ${validationResponse.data.formattedNumber}`);
      console.log(`   ID WhatsApp: ${validationResponse.data.numberId}`);
      
    } catch (validationError) {
      console.log(`⚠️ Erro ao validar número ${numeroWhatsApp}: ${validationError.message}`);
      
      // Se o erro contém indicação de número inválido, não prosseguir
      if (validationError.response && validationError.response.status === 400 && 
          validationError.response.data && !validationError.response.data.hasWhatsApp) {
        console.log(`❌ Validação confirmou que número não possui WhatsApp - cancelando envio`);
        
        await npsAPI.atualizarControleEnvio(controleId, {
          status_envio: 'numero_invalido',
          data_envio: new Date().toISOString().slice(0, 19).replace('T', ' '),
          ultimo_erro: `Número não possui conta WhatsApp (erro na validação): ${validationError.message}`
        });
        
        return {
          success: false,
          message: `Número ${numeroWhatsApp} não possui conta WhatsApp`,
          controleId: controleId,
          numeroValidado: false
        };
      }
      
      console.log(`   Prosseguindo com envio (assumindo que número é válido)...`);
      writeLog(`Erro na validação do número ${numeroWhatsApp} - Controle ${controleId}: ${validationError.message}`);
    }
    
    try {
      let response;
      
      // Verificar se a campanha tem imagem
      if (dadosCampanha.imagem && dadosCampanha.imagem_tipo) {
        console.log(`📸 Campanha possui imagem, enviando como mídia...`);
        
        // Preparar dados da mídia
        const mediaData = {
          data: dadosCampanha.imagem.replace(/^data:image\/\w+;base64,/, ''), // Remover prefixo data URL
          mimetype: dadosCampanha.imagem_tipo,
          filename: dadosCampanha.imagem_nome || 'campanha_nps.jpg'
        };
        
        // Enviar via WhatsApp Manager com mídia
        response = await axios.post(`${process.env.API_LOCAL_WHATSAPP}/api/instances/${pedido.instancia_id}/send-media`, {
          to: numeroWhatsApp,
          message: mensagemCompleta,
          media: mediaData
        });
      } else {
        console.log(`📝 Campanha sem imagem, enviando mensagem de texto NPS...`);
        
        // Enviar mensagem de texto via WhatsApp Manager
        response = await axios.post(`${process.env.API_LOCAL_WHATSAPP}/api/instances/${pedido.instancia_id}/send-message`, {
          to: numeroWhatsApp,
          message: mensagemCompleta
        });
      }
      
      if (response.data.success) {
        // Atualizar controle de envio usando a API
        await npsAPI.enviarMensagemNPS({
          controle_id: controleId,
          status_envio: 'enviado',
          message_id: response.data.messageId,
          celular: numeroWhatsApp,
          instancia_id: pedido.instancia_id,
          timeout_minutos: dadosCampanha.timeout_conversa_minutos || 60
        });
        
        // Estado de conversa já foi criado antes do envio em processarPedidoIndividualNPS
        writeLog(`Mensagem NPS individual enviada com sucesso para cliente ${pedido.CLIENTE} (${pedido.CODCLI}) - Estado de conversa já existe`);
      } else {
        throw new Error('Falha no envio da mensagem: ' + (response.data.error || 'Erro desconhecido'));
      }
    } catch (whatsappError) {
      // Atualizar controle com erro usando a API
      await npsAPI.enviarMensagemNPS({
        controle_id: controleId,
        status_envio: 'erro',
        ultimo_erro: whatsappError.message
      });
      
      throw whatsappError;
    }
    
  } catch (error) {
    writeLog(`Erro ao enviar NPS individual para cliente ${pedido.CODCLI}: ${error.message}`);
    throw error;
  }
}

// Função para enviar mensagem NPS (sistema antigo - mantido para compatibilidade)
async function enviarMensagemNPS(controleId, pedido) {
  try {
    // Buscar dados da campanha
    const campanhas = await npsAPI.buscarCampanhasAtivas();
    const campanha = campanhas.find(c => c.id === pedido.campanha_id);
    
    if (!campanha) {
      throw new Error(`Campanha ${pedido.campanha_id} não encontrada ou inativa`);
    }
    
    console.log(`📋 Dados da campanha carregados:`, {
      id: campanha.id,
      nome: campanha.nome,
      temImagem: !!(campanha.imagem && campanha.imagem_tipo)
    });
    
    // Personalizar mensagem
    const mensagem = campanha.mensagem_inicial
      .replace('{cliente}', pedido.CLIENTE)
      .replace('{pedido}', pedido.NUMPED)
      .replace('{valor}', formatarValor(pedido.VLTOTAL));
    
    // Formatar número para envio
    const numeroFormatado = formatarTelefone(pedido.TELCELENT);
    const numeroWhatsApp = formatarParaWhatsApp(numeroFormatado);
    
    try {
      let response;
      
      // Verificar se a campanha tem imagem
      if (campanha.imagem && campanha.imagem_tipo) {
        console.log(`📸 Campanha possui imagem, enviando como mídia...`);
        
        // Preparar dados da mídia
        const mediaData = {
          data: campanha.imagem.replace(/^data:image\/\w+;base64,/, ''), // Remover prefixo data URL
          mimetype: campanha.imagem_tipo,
          filename: campanha.imagem_nome || 'campanha_nps.jpg'
        };
        
        // Enviar via WhatsApp Manager com mídia
        response = await axios.post(`${process.env.API_LOCAL_WHATSAPP}/api/instances/${pedido.instancia_id}/send-media`, {
          to: numeroWhatsApp,
          message: mensagem,
          media: mediaData
        });
      } else {
        console.log(`📝 Campanha sem imagem, enviando apenas texto...`);
        
        // Enviar via WhatsApp Manager (texto apenas)
        response = await axios.post(`${process.env.API_LOCAL_WHATSAPP}/api/instances/${pedido.instancia_id}/send-message`, {
          to: numeroWhatsApp,
          message: mensagem
        });
      }
      
      if (response.data.success) {
        // Atualizar controle de envio usando a API
        await npsAPI.enviarMensagemNPS({
          controle_id: controleId,
          status_envio: 'enviado',
          message_id: response.data.messageId,
          celular: numeroWhatsApp,
          instancia_id: pedido.instancia_id,
          timeout_minutos: campanha.timeout_conversa_minutos || 60
        });
        
        writeLog(`Mensagem NPS enviada com sucesso para cliente ${pedido.CODCLI}`);
      } else {
        throw new Error('Falha no envio da mensagem: ' + response.data.error);
      }
    } catch (whatsappError) {
      // Atualizar controle com erro usando a API
      await npsAPI.enviarMensagemNPS({
        controle_id: controleId,
        status_envio: 'erro',
        ultimo_erro: whatsappError.message
      });
      
      throw whatsappError;
    }
    
  } catch (error) {
    writeLog(`Erro ao enviar mensagem NPS para cliente ${pedido.CODCLI}: ${error.message}`);
    throw error;
  }
}

// Função auxiliar para formatar telefone - PADRONIZADA
function formatarTelefone(telefone) {
  if (!telefone) return null;
  
  // Remove caracteres não numéricos
  const numeroLimpo = telefone.replace(/\D/g, '');
  
  // Valida se tem pelo menos 10 dígitos
  if (numeroLimpo.length < 10) return null;
  
  // PADRÃO: Sempre salvar no formato com nono dígito após DDD (ex: 94981413567)
  // Este é o formato que será usado tanto para envio quanto para busca
  
  let numeroFormatado;
  
  // Se tem 13 dígitos e começa com 55 (ex: 5594981413567)
  if (numeroLimpo.length === 13 && numeroLimpo.startsWith('55')) {
    numeroFormatado = numeroLimpo.substring(2); // Remove código do país -> 94981413567
  }
  // Se tem 12 dígitos e começa com 55 (ex: 559481413567)
  else if (numeroLimpo.length === 12 && numeroLimpo.startsWith('55')) {
    const semPais = numeroLimpo.substring(2); // 9481413567 (10 dígitos)
    // CORREÇÃO: Se já começa com 9, usar como está (já tem o nono dígito)
    if (semPais.startsWith('9')) {
      numeroFormatado = semPais; // 9481413567 -> usar como está
    } else {
      numeroFormatado = '9' + semPais; // Adiciona 9 para números sem o nono dígito
    }
  }
  // Se tem 11 dígitos (ex: 94981413567)
  else if (numeroLimpo.length === 11) {
    numeroFormatado = numeroLimpo; // Já está no formato correto
  }
  // Se tem 10 dígitos (ex: 4981413567)
  else if (numeroLimpo.length === 10) {
    numeroFormatado = '9' + numeroLimpo; // Adiciona 9 no início -> 94981413567
  }
  else {
    // Formato não reconhecido, retornar como está
    numeroFormatado = numeroLimpo;
  }
  
  return numeroFormatado;
}

// Função para converter número do formato padrão (94981413567) para WhatsApp (5594981413567@c.us)
function formatarParaWhatsApp(numeroFormatado) {
  if (!numeroFormatado) return null;
  
  // Se já tem @c.us, retornar como está
  if (numeroFormatado.includes('@c.us')) {
    return numeroFormatado;
  }
  
  // Adicionar código do país (55) se necessário
  let numeroWhatsApp = numeroFormatado;
  if (!numeroWhatsApp.startsWith('55')) {
    numeroWhatsApp = '55' + numeroWhatsApp;
  }
  
  return numeroWhatsApp + '@c.us';
}

// Função auxiliar para formatar valor
function formatarValor(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

// FUNÇÃO REMOVIDA: Versão duplicada da função gerarFormatosBusca
// A versão corrigida está na linha 137

// Função para processar respostas recebidas do WhatsApp
async function processarRespostaWhatsApp(numeroRemetente, instanciaId, mensagem, messageId) {
  try {
    console.log(`📨 Processando resposta WhatsApp:`);
    console.log(`   Número: ${numeroRemetente}`);
    console.log(`   Instância: ${instanciaId}`);
    console.log(`   Mensagem: ${mensagem}`);
    
    // Verificar se a mensagem está vazia (pode indicar exclusão de conversa)
    if (!mensagem || mensagem.trim() === '') {
      console.log(`ℹ️ Mensagem vazia recebida de ${numeroRemetente}, pode indicar exclusão de conversa. Não processando.`);
      return {
        success: false,
        message: 'Mensagem vazia - possível exclusão de conversa',
        skipProcessing: true
      };
    }
    
    // Gerar múltiplos formatos para busca
    const formatosBusca = gerarFormatosBusca(numeroRemetente);
    
    console.log(`🔍 Formatos de busca gerados: ${formatosBusca.join(', ')}`);
    
    // Buscar conversa ativa usando múltiplos formatos
    const conversaAtiva = await npsAPI.getConversaAtiva(formatosBusca, instanciaId);
    
    if (!conversaAtiva) {
      console.log(`ℹ️  Nenhuma conversa NPS ativa encontrada para ${numeroRemetente}`);
      return {
        success: false,
        message: 'Conversa não encontrada'
      };
    }
    
    console.log(`✅ Conversa NPS encontrada:`);
    console.log(`   ID: ${conversaAtiva.id}`);
    console.log(`   Celular salvo: ${conversaAtiva.celular}`);
    console.log(`   Controle ID: ${conversaAtiva.controle_envio_id}`);
    
    // Buscar dados do controle de envio para obter o pedido_id
    console.log(`🔍 Buscando dados do controle de envio ID: ${conversaAtiva.controle_envio_id}`);
    
    let controleEnvio;
    try {
      // Buscar controle de envio via API
      const resultadoControle = await npsAPI.buscarControleEnvioPorId(conversaAtiva.controle_envio_id);
      
      if (!resultadoControle.success || !resultadoControle.controle) {
        throw new Error(`Controle de envio ${conversaAtiva.controle_envio_id} não encontrado`);
      }
      
      controleEnvio = resultadoControle.controle;
      
      if (!controleEnvio.pedido_id) {
        throw new Error(`Controle de envio ${conversaAtiva.controle_envio_id} não possui pedido_id`);
      }
      
      console.log(`✅ Controle encontrado via API - Pedido ID: ${controleEnvio.pedido_id}`);
    } catch (error) {
      console.error(`❌ Erro ao buscar controle de envio via API: ${error.message}`);
      return {
        success: false,
        message: 'Erro ao processar resposta: dados do pedido não encontrados'
      };
    }
    
    // Processar resposta NPS baseado na mensagem
    let respostaNPS = null;
    let novoStatus = 'respondido';
    
    // Função para validar se a mensagem é um número NPS válido
    function validarRespostaNPS(mensagem) {
      const mensagemLimpa = mensagem.trim();
      
      // Verificar se a mensagem contém apenas dígitos (e opcionalmente espaços)
      if (!/^\d+$/.test(mensagemLimpa)) {
        return {
          valida: false,
          motivo: 'A resposta deve conter apenas números (0 a 10).'
        };
      }
      
      const numero = parseInt(mensagemLimpa);
      
      // Verificar se está na faixa válida do NPS (0-10)
      if (numero < 0 || numero > 10) {
        return {
          valida: false,
          motivo: 'Por favor, responda com uma nota de 0 a 10.'
        };
      }
      
      return {
        valida: true,
        nota: numero
      };
    }
    
    // Validar resposta NPS
    const validacao = validarRespostaNPS(mensagem);
    
    if (validacao.valida) {
      // Resposta numérica válida (nota NPS)
      const nota = validacao.nota;
      respostaNPS = {
        pedido_id: controleEnvio.pedido_id, // Campo obrigatório
        codcli: controleEnvio.codcli, // Campo obrigatório adicionado
        campanha_id: controleEnvio.campanha_id, // Campo obrigatório adicionado
        controle_envio_id: conversaAtiva.controle_envio_id,
        instancia_id: instanciaId,
        celular: numeroRemetente,
        nota_nps: nota,
        resposta_texto: mensagem,
        message_id: messageId,
        data_resposta: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };
      
      console.log(`📊 Nota NPS recebida: ${nota} para pedido ${controleEnvio.pedido_id} (Cliente: ${controleEnvio.codcli})`);
    } else {
      // Resposta inválida - enviar mensagem de orientação
      console.log(`⚠️ Resposta NPS inválida recebida: "${mensagem}" - ${validacao.motivo}`);
      
      try {
        // Enviar mensagem de orientação para o usuário
        const mensagemOrientacao = validacao.motivo;
        
        const axios = require('axios');
        const responseWhatsApp = await axios.post(`${process.env.API_LOCAL_WHATSAPP}/api/instances/${conversaAtiva.instancia_id}/send-message`, {
          to: numeroRemetente,
          message: mensagemOrientacao
        });
        
        if (responseWhatsApp.data.success) {
          console.log(`✅ Mensagem de orientação enviada com sucesso`);
          writeLog(`Mensagem de orientação enviada para ${numeroRemetente}: resposta inválida "${mensagem}"`);
        } else {
          console.log(`⚠️ Falha ao enviar mensagem de orientação: ${responseWhatsApp.data.error || 'Erro desconhecido'}`);
        }
      } catch (errorOrientacao) {
        console.log(`⚠️ Erro ao enviar mensagem de orientação: ${errorOrientacao.message}`);
      }
      
      // Retornar sem processar a resposta inválida
      return {
        success: false,
        message: `Resposta inválida: ${validacao.motivo}`,
        needsValidResponse: true
      };
    }
    
    // Salvar resposta NPS
    const resultadoResposta = await npsAPI.salvarRespostaNPS(respostaNPS);
    
    if (resultadoResposta && resultadoResposta.success) {
      console.log(`✅ Resposta NPS salva com sucesso (ID: ${resultadoResposta.id})`);
      
      // Atualizar estado da conversa para 'respondido'
      await npsAPI.atualizarEstadoConversa(conversaAtiva.id, {
        aguardando_resposta: false,
        status: novoStatus,
        data_resposta: new Date().toISOString().slice(0, 19).replace('T', ' ')
      });
      
      console.log(`✅ Estado da conversa atualizado para '${novoStatus}'`);
      
      // Buscar dados da campanha para obter mensagem de agradecimento
      try {
        const dadosCampanha = await npsAPI.getCampanhaPorId(controleEnvio.campanha_id);
        
        if (dadosCampanha && dadosCampanha.mensagem_final) {
          console.log(`📤 Enviando mensagem final...`);
          
          // Personalizar mensagem final
          let mensagemFinal = dadosCampanha.mensagem_final;
          
          // Substituir placeholders se existirem
          if (mensagemFinal.includes('{cliente}') || mensagemFinal.includes('{nota}')) {
            // Buscar dados do cliente para personalização
            const dadosCliente = await buscarDadosCliente(controleEnvio.codcli);
            const nomeCliente = dadosCliente ? dadosCliente.CLIENTE : 'Cliente';
            
            mensagemFinal = mensagemFinal
              .replace('{cliente}', nomeCliente)
              .replace('{nota}', nota || 'sua resposta');
          }
          
          // Enviar mensagem final via WhatsApp Manager
          const axios = require('axios');
          const responseWhatsApp = await axios.post(`${process.env.API_LOCAL_WHATSAPP}/api/instances/${conversaAtiva.instancia_id}/send-message`, {
            to: numeroRemetente,
            message: mensagemFinal
          });
          
          if (responseWhatsApp.data.success) {
            console.log(`✅ Mensagem final enviada com sucesso`);
            writeLog(`Mensagem final enviada para ${numeroRemetente}: ${mensagemFinal}`);
          } else {
            console.log(`⚠️ Falha ao enviar mensagem final: ${responseWhatsApp.data.error || 'Erro desconhecido'}`);
            writeLog(`Erro ao enviar mensagem final para ${numeroRemetente}: ${responseWhatsApp.data.error}`);
          }
        } else {
          // Enviar mensagem padrão final se não houver configurada na campanha
          const mensagemPadrao = 'Obrigado pela sua avaliação! Sua opinião é muito importante para nós. 😊';
          
          console.log(`📤 Enviando mensagem padrão final...`);
          
          const axios = require('axios');
          const responseWhatsApp = await axios.post(`${process.env.API_LOCAL_WHATSAPP}/api/instances/${conversaAtiva.instancia_id}/send-message`, {
            to: numeroRemetente,
            message: mensagemPadrao
          });
          
          if (responseWhatsApp.data.success) {
            console.log(`✅ Mensagem padrão final enviada com sucesso`);
            writeLog(`Mensagem padrão final enviada para ${numeroRemetente}`);
          } else {
            console.log(`⚠️ Falha ao enviar mensagem padrão final: ${responseWhatsApp.data.error || 'Erro desconhecido'}`);
            writeLog(`Erro ao enviar mensagem padrão final para ${numeroRemetente}: ${responseWhatsApp.data.error}`);
          }
        }
      } catch (errorMensagem) {
        console.log(`⚠️ Erro ao enviar mensagem final: ${errorMensagem.message}`);
        writeLog(`Erro ao enviar mensagem final: ${errorMensagem.message}`);
        // Não falhar o processamento por causa do erro na mensagem final
      }
      
      writeLog(`Resposta NPS processada: Controle ${conversaAtiva.controle_envio_id}, Nota: ${nota || 'N/A'}, Texto: ${mensagem}`);
      
      return {
        success: true,
        message: `Resposta NPS processada com sucesso`,
        conversaId: conversaAtiva.id,
        respostaId: resultadoResposta.id,
        nota: nota || null
      };
      
    } else {
      console.log(`❌ Erro ao salvar resposta NPS: ${resultadoResposta?.message || 'Erro desconhecido'}`);
      return {
        success: false,
        message: 'Erro ao salvar resposta NPS'
      };
    }
    
  } catch (error) {
    console.error(`❌ Erro ao processar resposta WhatsApp: ${error.message}`);
    writeLog(`Erro ao processar resposta WhatsApp de ${numeroRemetente}: ${error.message}`);
    
    return {
      success: false,
      message: `Erro no processamento: ${error.message}`
    };
  }
}

// Função para processar envios agendados pendentes
async function processarEnviosAgendadosHorario() {
  try {
    console.log('🔄 Iniciando processamento de envios agendados...');
    writeLog('Iniciando processamento de envios agendados');
    
    // Buscar envios agendados via API
    const enviosAgendados = await npsAPI.getEnviosAgendados();
    
    if (!enviosAgendados || enviosAgendados.length === 0) {
      console.log('ℹ️  Nenhum envio agendado encontrado');
      return;
    }
    
    console.log(`📋 Encontrados ${enviosAgendados.length} envios agendados para processar`);
    
    let processados = 0;
    let erros = 0;
    
    for (const envio of enviosAgendados) {
      try {
        console.log(`📤 Processando envio agendado ID: ${envio.id}`);
        console.log(`   Status atual: ${envio.status_envio}`);
        console.log(`   Cliente: ${envio.codcli}`);
        console.log(`   Campanha: ${envio.campanha_id}`);
        
        // Buscar dados da campanha
        const dadosCampanha = await npsAPI.getCampanhaPorId(envio.campanha_id);
        if (!dadosCampanha) {
          console.log(`⚠️ Campanha ${envio.campanha_id} não encontrada`);
          continue;
        }
        
        // Preparar pedido para envio
        const pedido = {
          id: envio.pedido_id,
          codcli: envio.codcli,
          celular: envio.celular,
          nome_cliente: envio.nome_cliente || 'Cliente',
          valor_total: envio.valor_total || 0,
          data_pedido: envio.data_pedido,
          instancia_id: envio.instancia_id
        };
        
        // Validar número WhatsApp antes de enviar
        console.log(`🔍 Validando número ${envio.celular} antes do envio...`);
        
        try {
          const validationResponse = await axios.post(`${process.env.API_LOCAL_WHATSAPP}/api/instances/${envio.instancia_id}/validate-number`, {
            number: envio.celular
          });
          
          if (!validationResponse.data.success || !validationResponse.data.hasWhatsApp) {
            const motivo = validationResponse.data.error || 'Número não possui conta WhatsApp';
            console.log(`❌ Número ${envio.celular} não possui conta WhatsApp: ${motivo}`);
            writeLog(`Número ${envio.celular} não possui conta WhatsApp - Envio ${envio.id}: ${motivo}`);
            
            // Atualizar status do controle para 'numero_invalido'
            await npsAPI.atualizarControleEnvio(envio.id, {
              status_envio: 'numero_invalido',
              data_envio: new Date().toISOString().slice(0, 19).replace('T', ' '),
              ultimo_erro: `Número não possui conta WhatsApp: ${motivo}`
            });
            
            erros++;
            console.log(`❌ Envio agendado ${envio.id} marcado como número inválido`);
            continue;
          }
          
          console.log(`✅ Número ${envio.celular} possui conta WhatsApp - prosseguindo`);
          
        } catch (validationError) {
          console.log(`⚠️ Erro ao validar número ${envio.celular}: ${validationError.message}`);
          console.log(`   Prosseguindo com envio (assumindo que número é válido)...`);
          writeLog(`Erro na validação do número ${envio.celular} - Envio ${envio.id}: ${validationError.message}`);
        }
        
        // Enviar mensagem NPS
        await enviarMensagemNPSIndividual(envio.id, pedido, dadosCampanha);
        
        processados++;
        console.log(`✅ Envio agendado ${envio.id} processado com sucesso`);
        
      } catch (error) {
        erros++;
        console.error(`❌ Erro ao processar envio agendado ${envio.id}: ${error.message}`);
        writeLog(`Erro ao processar envio agendado ${envio.id}: ${error.message}`);
      }
    }
    
    console.log(`📊 Processamento de envios agendados concluído:`);
    console.log(`   Processados: ${processados}`);
    console.log(`   Erros: ${erros}`);
    
    writeLog(`Processamento de envios agendados concluído: ${processados} processados, ${erros} erros`);
    
  } catch (error) {
    console.error(`❌ Erro geral no processamento de envios agendados: ${error.message}`);
    writeLog(`Erro geral no processamento de envios agendados: ${error.message}`);
  }
}

// Configurar cron jobs
function configurarCronJobs() {
  // Obter intervalo de monitoramento do .env (padrão: 120000ms = 2 minutos)
  const intervalMs = parseInt(process.env.NPS_MONITOR_INTERVAL_MS) || 120000;
  const intervalSegundos = Math.round(intervalMs / 1000);
  const intervalTexto = intervalSegundos >= 60 
    ? `${Math.round(intervalSegundos / 60)} minuto(s)`
    : `${intervalSegundos} segundo(s)`;
  
  // Converter milissegundos para expressão cron
  let cronExpression;
  if (intervalSegundos < 60) {
    // Para intervalos menores que 1 minuto, usar segundos
    cronExpression = `*/${intervalSegundos} * * * * *`;
  } else {
    // Para intervalos de minutos ou mais
    const minutos = Math.round(intervalSegundos / 60);
    cronExpression = `*/${minutos} * * * *`;
  }
  
  // Verificar novos pedidos individuais com intervalo configurável
  cron.schedule(cronExpression, async () => {
    try {
      await processarDisparoImediato();
    } catch (error) {
      writeLog('Erro no cron de disparo imediato individual: ' + error.message);
    }
  });
  
  // Processar envios agendados por horário a cada 30 minutos
  cron.schedule('*/30 * * * *', async () => {
    try {
      await processarEnviosAgendadosHorario();
    } catch (error) {
      writeLog('Erro no cron de envios agendados por horário: ' + error.message);
    }
  });
  
  writeLog(`Cron jobs configurados:`);
  writeLog(`  - Disparo individual: a cada ${intervalTexto} (${intervalMs}ms)`);
  writeLog(`  - Envios agendados por horário: a cada 30 minutos`);
  writeLog('💡 Configure NPS_MONITOR_INTERVAL_MS no .env para alterar o intervalo base');
  writeLog('ℹ️ Para consolidação de estados, execute: node nps-consolidador.js --service');
}

// Função para verificar se um número já respondeu anteriormente
async function verificarRespostaAnterior(numeroDestinatario, instanceId) {
  try {
    console.log(`🔍 Verificando se ${numeroDestinatario} já respondeu anteriormente na instância ${instanceId}`);
    
    // Gerar múltiplos formatos para busca
    const formatosBusca = gerarFormatosBusca(numeroDestinatario);
    
    // Buscar respostas anteriores usando a API
    const respostasAnteriores = await npsAPI.buscarRespostasAnteriores(formatosBusca, instanceId);
    
    if (respostasAnteriores && respostasAnteriores.length > 0) {
      console.log(`✅ Encontradas ${respostasAnteriores.length} respostas anteriores para ${numeroDestinatario}`);
      return true;
    }
    
    console.log(`ℹ️ Nenhuma resposta anterior encontrada para ${numeroDestinatario}`);
    return false;
    
  } catch (error) {
    console.error(`Erro ao verificar resposta anterior para ${numeroDestinatario}:`, error.message);
    // Em caso de erro, assumir que não respondeu para garantir o envio
    return false;
  }
}

module.exports = {
  buscarDadosCliente,
  // buscarPedidosElegiveis - REMOVIDA: consultava Oracle diretamente
  // processarEnviosNPS - REMOVIDA: dependia da função buscarPedidosElegiveis
  processarRespostaWhatsApp,
  processarDisparoImediato,
  processarEnviosAgendadosHorario,
  processarPedidoIndividualNPS,
  enviarMensagemNPSIndividual,
  buscarNovosPedidosDB,
  configurarCronJobs,
  validarHorarioEnvio,
  verificarRespostaAnterior,
  writeLog
};

// Se executado diretamente
if (require.main === module) {
  // Verificar argumentos da linha de comando
  const args = process.argv.slice(2);
  const modoService = args.includes('--service');
  const modoUnico = args.includes('--once') || args.includes('-o');
  
  if (modoService) {
    // Modo serviço: inicializar autenticação e usar cron jobs
    initializeAuth()
      .then(() => {
        configurarCronJobs();
        writeLog('🔧 Serviço NPS iniciado com cron jobs (3 segundos)');
        
        // Manter o processo rodando
        process.on('SIGINT', () => {
          writeLog('🛑 Serviço NPS encerrado');
          process.exit(0);
        });
        
        // Manter vivo
        setInterval(() => {}, 1000);
      })
      .catch((error) => {
        writeLog('❌ Erro na inicialização da autenticação: ' + error.message);
        process.exit(1);
      });
    
  } else if (modoUnico) {
    // Modo único: inicializar autenticação, executa uma vez e para
    writeLog('🔄 Executando verificação única de NPS...');
    initializeAuth()
      .then(() => processarDisparoImediato())
      .then(() => {
        writeLog('✅ Processamento NPS individual concluído com sucesso.');
        process.exit(0);
      })
      .catch((error) => {
        writeLog('❌ Erro no processamento NPS individual: ' + error.message);
        process.exit(1);
      });
      
  } else {
    // Modo contínuo: inicializar autenticação e monitorar em tempo real (padrão)
    writeLog('🎯 Iniciando monitoramento contínuo de NPS...');
    initializeAuth()
      .then(() => iniciarMonitoramentoContinuo())
      .catch((error) => {
        writeLog('❌ Erro no monitoramento contínuo: ' + error.message);
        process.exit(1);
      });
  }
}
