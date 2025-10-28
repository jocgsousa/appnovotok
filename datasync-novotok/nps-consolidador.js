require('dotenv/config');
const cron = require('node-cron');
const { initializeAuth } = require('./api-client');
const { NPSSyncAPI } = require('./api-client');

/**
 * NPS Consolidador - Sistema de consolidação de estados de conversa
 * 
 * Garante que todo registro em controle_envios_nps tenha um
 * estado_conversa_nps correspondente para manter a integridade dos dados.
 */

let npsAPI = null;

/**
 * Escreve log com timestamp
 */
function writeLog(message, level = 'INFO') {
    return false;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[${timestamp}] [${level}] ${message}`);
}

/**
 * Função principal do consolidador
 * Busca controles de envio órfãos e cria estados de conversa faltantes
 */
async function consolidarEstadosConversa() {
    try {
        writeLog('🔍 Verificando integridade entre controle_envios_nps e estado_conversa_nps...');
        
        if (!npsAPI) {
            writeLog('❌ API não inicializada. Execute initializeConsolidador() primeiro.', 'ERROR');
            return { success: false, error: 'API não inicializada' };
        }

        // Buscar controles sem estado correspondente
        const response = await npsAPI.getControlesSemEstado();
        
        if (!response || !response.controles || response.controles.length === 0) {
            writeLog('✅ Todos os controles de envio possuem estado de conversa correspondente');
            return { success: true, processados: 0, criados: 0, erros: 0 };
        }

        const controlesSemEstado = response.controles;
        writeLog(`📋 Encontrados ${controlesSemEstado.length} controles sem estado de conversa`);
        
        let criados = 0;
        let erros = 0;
        
        for (const controle of controlesSemEstado) {
            try {
                // Validar dados do controle
                if (!controle.celular) {
                    writeLog(`⚠️ Controle ${controle.id} sem número de celular - pulando`, 'WARN');
                    continue;
                }
                
                // Formatar número para WhatsApp
                let numeroParaSalvar = controle.celular.toString().trim();
                if (!numeroParaSalvar.startsWith('55')) {
                    numeroParaSalvar = '55' + numeroParaSalvar;
                }
                if (!numeroParaSalvar.includes('@c.us')) {
                    numeroParaSalvar = numeroParaSalvar + '@c.us';
                }

                // Calcular timeout (padrão 60 minutos)
                const timeoutMinutos = 60;
                const dataTimeout = new Date();
                dataTimeout.setMinutes(dataTimeout.getMinutes() + timeoutMinutos);

                // Criar estado de conversa
                const estadoData = {
                    controle_envio_id: controle.id,
                    instancia_id: controle.instancia_id,
                    celular: numeroParaSalvar,
                    pergunta_atual_id: null,  // NULL em vez de 0 para evitar constraint violation
                    ordem_resposta: 0,
                    aguardando_resposta: true,
                    proxima_acao: 'pergunta_principal',
                    data_timeout: dataTimeout.toISOString().slice(0, 19).replace('T', ' ')
                };

                writeLog(`🔧 Criando estado para controle ${controle.id} (${numeroParaSalvar})`);
                
                const resultado = await npsAPI.createEstadoConversa(estadoData);
                
                if (resultado.success) {
                    writeLog(`✅ Estado criado com sucesso (ID: ${resultado.estado.id})`);
                    criados++;
                } else {
                    if (resultado.error && resultado.error.includes('Duplicate entry')) {
                        writeLog(`ℹ️ Estado já existe para controle ${controle.id} (ignorado)`);
                    } else {
                        writeLog(`❌ Erro ao criar estado para controle ${controle.id}: ${resultado.error}`, 'ERROR');
                        erros++;
                    }
                }
                
            } catch (error) {
                writeLog(`❌ Erro ao processar controle ${controle.id}: ${error.message}`, 'ERROR');
                erros++;
            }
        }

        const resultado = {
            success: true,
            processados: controlesSemEstado.length,
            criados: criados,
            erros: erros
        };

        writeLog(`📊 Consolidação concluída: ${criados} criados, ${erros} erros de ${controlesSemEstado.length} processados`);
        
        return resultado;
        
    } catch (error) {
        writeLog(`❌ Erro geral na consolidação de estados: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }
}

/**
 * Inicializa a autenticação e API
 */
async function initializeConsolidador() {
    try {
        writeLog('🔐 Inicializando consolidador NPS...');
        
        // Inicializar autenticação
        await initializeAuth();
        
        // Inicializar API
        npsAPI = new NPSSyncAPI();
        
        writeLog('✅ Consolidador inicializado com sucesso');
        return { success: true };
        
    } catch (error) {
        writeLog(`❌ Erro ao inicializar consolidador: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }
}

/**
 * Configura os cron jobs do consolidador
 */
function configurarCronJobs() {
    const intervalMs = parseInt(process.env.NPS_MONITOR_INTERVAL_MS) || 120000; // 2 minutos padrão
    
    // Adicionar offset de 4 segundos para evitar conflito com o cron de novos pedidos
    const offsetMs = 4000;
    const intervalComOffset = intervalMs + offsetMs;
    
    let cronExpression;
    let tempoLegivel;
    
    if (intervalComOffset < 60000) {
        // Para intervalos menores que 1 minuto, usar segundos
        const segundos = Math.floor(intervalComOffset / 1000);
        cronExpression = `*/${segundos} * * * * *`;
        tempoLegivel = `${segundos} segundo(s)`;
    } else {
        // Para intervalos de 1 minuto ou mais, converter para minutos
        const minutos = Math.floor(intervalComOffset / 60000);
        cronExpression = `*/${minutos} * * * *`;
        tempoLegivel = `${minutos} minuto(s)`;
    }
    
    writeLog(`⏰ Configurando consolidador para executar a cada ${tempoLegivel} (${intervalComOffset}ms)`);
    writeLog(`📝 Para alterar o intervalo, configure NPS_MONITOR_INTERVAL_MS no arquivo .env`);
    
    // Cron job para consolidação
    cron.schedule(cronExpression, async () => {
        writeLog('🔄 Executando consolidação automática...');
        await consolidarEstadosConversa();
    });
    
    writeLog('✅ Cron jobs do consolidador configurados');
}

/**
 * Execução principal
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
NPS Consolidador - Sistema de consolidação de estados de conversa

Uso:
  node nps-consolidador.js [opções]

Opções:
  (nenhuma)    Executa como serviço contínuo (padrão)
  --service    Executa como serviço com cron jobs automáticos (mesmo que padrão)
  --once       Executa consolidação uma única vez e encerra
  --help, -h   Mostra esta ajuda

Variáveis de ambiente:
  NPS_MONITOR_INTERVAL_MS    Intervalo de consolidação em milissegundos (padrão: 120000 = 2min)

Exemplos:
  node nps-consolidador.js              # Modo serviço contínuo (padrão)
  node nps-consolidador.js --service    # Modo serviço contínuo (explícito)
  node nps-consolidador.js --once       # Execução única
        `);
        return;
    }
    
    // Inicializar consolidador
    const initResult = await initializeConsolidador();
    if (!initResult.success) {
        writeLog('❌ Falha na inicialização. Encerrando.', 'ERROR');
        process.exit(1);
    }
    
    if (args.includes('--once')) {
        writeLog('🔄 Executando consolidação única...');
        const resultado = await consolidarEstadosConversa();
        
        if (resultado.success) {
            writeLog('✅ Consolidação única concluída com sucesso');
            process.exit(0);
        } else {
            writeLog('❌ Consolidação única falhou', 'ERROR');
            process.exit(1);
        }
        
    } else {
        // Modo serviço por padrão (sem parâmetros ou com --service)
        writeLog('🚀 Iniciando consolidador em modo serviço...');
        configurarCronJobs();
        
        // Manter o processo ativo
        process.on('SIGINT', () => {
            writeLog('🛑 Recebido sinal de interrupção. Encerrando consolidador...');
            process.exit(0);
        });
        
        // Executar uma consolidação inicial
        writeLog('🔄 Executando consolidação inicial...');
        await consolidarEstadosConversa();
        
        writeLog('✅ Consolidador em execução. Pressione Ctrl+C para parar.');
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    main().catch(error => {
        writeLog(`❌ Erro fatal: ${error.message}`, 'ERROR');
        process.exit(1);
    });
}

module.exports = {
    consolidarEstadosConversa,
    initializeConsolidador,
    configurarCronJobs,
    writeLog
};
