require('dotenv').config();

const { initializeAuth, getAuthInfo, NPSSyncAPI, WhatsAppInstancesAPI } = require('./api-client');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--campanha' || a === '-c') out.campanhaId = Number(args[++i]);
    else if (a === '--minutos' || a === '-m') out.minutos = Number(args[++i]);
    else if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function logHeader(title) {
  console.log('\n=== ' + title + ' ===');
}

function validarPeriodoCampanhaSimples(campanha) {
  const now = new Date();
  const inicio = campanha?.data_inicio ? new Date(campanha.data_inicio) : null;
  const fim = campanha?.data_fim ? new Date(campanha.data_fim) : null;
  const ativo = (!inicio || now >= inicio) && (!fim || now <= fim);
  let motivo = 'ativa';
  if (inicio && now < inicio) motivo = 'fora_do_periodo: antes do início';
  else if (fim && now > fim) motivo = 'fora_do_periodo: após o fim';
  return { ativo, motivo, now, inicio, fim };
}

function validarHorarioEnvioSimples(campanha) {
  const inicioStr = campanha?.horario_envio_inicio || process.env.NPS_DEFAULT_HORARIO_INICIO || '09:00';
  const fimStr = campanha?.horario_envio_fim || process.env.NPS_DEFAULT_HORARIO_FIM || '20:00';
  const [ih, im] = inicioStr.split(':').map(Number);
  const [fh, fm] = fimStr.split(':').map(Number);
  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();
  const startMin = ih * 60 + im;
  const endMin = fh * 60 + fm;
  let dentroJanela;
  if (startMin <= endMin) {
    dentroJanela = curMin >= startMin && curMin <= endMin;
  } else {
    // janela cruza meia-noite
    dentroJanela = curMin >= startMin || curMin <= endMin;
  }
  return { dentroJanela, inicioStr, fimStr, curMin, startMin, endMin };
}

async function main() {
  const args = parseArgs();
  if (args.help || !args.campanhaId) {
    console.log('Uso: node datasync-novotok/diagnostico-campanha.js --campanha <id> [--minutos <N>] [--verbose]');
    process.exit(args.help ? 0 : 1);
  }

  await initializeAuth();
  const authInfo = await getAuthInfo();

  const npsAPI = new NPSSyncAPI();
  const waAPI = new WhatsAppInstancesAPI();

  logHeader('Autenticação');
  console.log({ tokenObtido: !!authInfo?.token, expiraEm: authInfo?.expiresAt || null });

  logHeader('Campanha');
  const campanha = await npsAPI.getCampanhaPorId(args.campanhaId);
  if (!campanha) {
    console.error('Campanha não encontrada:', args.campanhaId);
    process.exit(2);
  }

  const periodo = validarPeriodoCampanhaSimples(campanha);
  const horario = validarHorarioEnvioSimples(campanha);

  console.log({
    id: campanha.id,
    nome: campanha.nome,
    status: campanha.status,
    disparo_imediato: !!campanha.disparo_imediato,
    dias_apos_compra: campanha.dias_apos_compra,
    horario_envio_inicio: campanha.horario_envio_inicio,
    horario_envio_fim: campanha.horario_envio_fim,
    filiais_ativas: campanha.filiais_ativas,
    data_inicio: campanha.data_inicio,
    data_fim: campanha.data_fim,
  });
  console.log({ periodo, horario });

  logHeader('Instância WhatsApp');
  let instanciaOk = null;
  try {
    const inst = await waAPI.getById(campanha.instancia_id);
    instanciaOk = !!inst && (inst.status === 'ativa' || inst.status === 'connected' || inst.status === 'running');
    console.log({ instancia_id: campanha.instancia_id, status: inst?.status || 'desconhecido', instanciaOk });
  } catch (e) {
    console.log({ instancia_id: campanha.instancia_id, erro: e?.message || String(e) });
  }

  logHeader('Controles pendentes (agendados)');
  const agendados = await npsAPI.getEnviosAgendados();
  const pendentesCampanha = (agendados?.agendados || []).filter(a => Number(a.campanha_id) === Number(args.campanhaId));
  console.log({ totalPendentes: pendentesCampanha.length });
  if (args.verbose) {
    console.log(pendentesCampanha.slice(0, 10));
  }

  if (campanha.disparo_imediato) {
    logHeader('Pedidos recentes (disparo imediato)');
    const minutos = Number.isFinite(args.minutos) ? args.minutos : (Number(process.env.NPS_MINUTOS_PEDIDOS_RECENTES) || 60);
    const filiais = campanha.filiais_ativas && campanha.filiais_ativas.length ? campanha.filiais_ativas : [];
    const pedidos = await npsAPI.getPedidosVendasRecentes({ minutos, filiais });
    console.log({ minutos, filiais, total: pedidos?.length || 0 });
    if (args.verbose) {
      console.log((pedidos || []).slice(0, 10));
    }
  }

  logHeader('Resumo');
  const resumo = {
    campanhaAtiva: campanha.status === 'ativa' && periodo.ativo,
    janelaValidaAgora: horario.dentroJanela,
    whatsappOK: instanciaOk === true,
    pendentesParaProcessar: pendentesCampanha.length,
    fluxo: campanha.disparo_imediato ? 'imediato' : 'agendado',
  };
  console.log(resumo);

  if (!resumo.campanhaAtiva) {
    console.log('\nDiagnóstico: campanha inativa ou fora do período. Verifique status/data_inicio/data_fim.');
  } else if (!resumo.whatsappOK) {
    console.log('\nDiagnóstico: instância WhatsApp não está ativa/connected/running.');
  } else if (!resumo.janelaValidaAgora) {
    console.log('\nDiagnóstico: fora do horário de envio configurado.');
  } else if (resumo.fluxo === 'agendado' && resumo.pendentesParaProcessar === 0) {
    console.log('\nDiagnóstico: nenhum controle pendente para esta campanha.');
  } else {
    console.log('\nDiagnóstico: sem bloqueios aparentes; fluxo deve funcionar.');
  }
}

main().catch(err => {
  console.error('Falha no diagnóstico:', err?.message || err);
  process.exit(1);
});