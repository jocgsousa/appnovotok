require('dotenv/config');
const { apiClient, initializeAuth } = require('./api-client');

async function runDebug(limit = 30, filiais = null) {
  await initializeAuth();
  const params = new URLSearchParams();
  if (limit) params.append('limit', String(limit));
  if (filiais) params.append('filiais', Array.isArray(filiais) ? filiais.join(',') : String(filiais));

  const url = `/debug_pedidos_vendas.php?${params.toString()}`;
  console.log(`\n🔎 GET ${process.env.API_BASE_URL || 'http://192.168.10.112:8000'}${url}`);
  const resp = await apiClient.get(url, { timeout: 15000 });
  const data = resp.data;
  console.log(`✅ Status: ${resp.status}`);

  if (!data.success) {
    console.error('❌ Falha no diagnóstico:', data);
    return;
  }

  const sum = data.summary || {};
  console.log('📊 Resumo:');
  console.log(`   total_rows: ${sum.total_rows}`);
  console.log(`   com_dtfat: ${sum.com_dtfat}`);
  console.log(`   sem_dtfat: ${sum.sem_dtfat}`);
  console.log(`   min_data: ${sum.min_data}`);
  console.log(`   max_data: ${sum.max_data}`);
  console.log(`   max_dtfat_composta: ${sum.max_dtfat_composta}`);

  const dist = data.filiais_distribuicao || [];
  console.log(`\n🏬 Distribuição por filial (top ${dist.length}):`);
  dist.slice(0, 10).forEach(r => {
    console.log(`   filial ${r.codfilial}: ${r.total}`);
  });

  const showSample = (label, arr) => {
    console.log(`\n🧪 ${label} (limite ${limit}) - registros: ${Array.isArray(arr) ? arr.length : 0}`);
    if (Array.isArray(arr) && arr.length > 0) {
      console.log('   Primeiro item:', arr[0]);
    }
  };

  showSample('Amostra por faturamento (dtfat/horafat/minutofat)', data.amostra_faturamento);
  showSample('Amostra por data cabeçalho (data)', data.amostra_data);
  showSample('Amostra sem dtfat', data.amostra_sem_dtfat);
}

(async function runAlt(limit = 30, filiais = null) {
  try {
    await initializeAuth();
    const params = new URLSearchParams();
    params.append('debug', '1');
    params.append('limit', String(limit));
    const url = `/nps_sync_api_pedidos_vendas_recentes.php?${params.toString()}`;
    console.log(`\n🧭 Tentando endpoint alternativo: ${process.env.API_BASE_URL || 'http://192.168.10.112:8000'}${url}`);
    const r = await apiClient.get(url);
    console.log('✅ Alt status:', r.status);
    console.log('   count:', Array.isArray(r.data) ? r.data.length : r.data?.count);
    if (Array.isArray(r.data) && r.data.length) {
      console.log('   Primeiro:', r.data[0]);
    }
  } catch (e) {
    const status = e.response?.status;
    const body = e.response?.data;
    console.error(`❌ Falha no endpoint alternativo (${status ?? 'sem status'})`, body || e.message);
  }
})();

(async () => {
  try {
    await runDebug(50);
    // Também chama o endpoint normal com janela temporal ampla
    await initializeAuth();
    const qs = new URLSearchParams();
    qs.append('minutos', '180');
    qs.append('limit', '50');
    const normalUrl = `/nps_sync_api_pedidos_vendas_recentes.php?${qs.toString()}`;
    console.log(`\n⏱️ Testando endpoint principal: ${process.env.API_BASE_URL || 'http://192.168.10.112:8000'}${normalUrl}`);
    const rnorm = await apiClient.get(normalUrl);
    console.log('✅ Principal status:', rnorm.status);
    console.log('   count:', rnorm.data?.count);
    if (rnorm.data?.pedidos?.length) {
      console.log('   Primeiro pedido:', rnorm.data.pedidos[0]);
    }
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    console.error(`❌ Erro ao executar diagnóstico (${status ?? 'sem status'}):`, body || err.message);
    if (body) {
      try { console.error('Detalhes:', JSON.stringify(body, null, 2)); } catch {}
    }
    // Tenta endpoint alternativo sem filtros temporais
    await new Promise(r => setTimeout(r, 250));
    await (async function runAlt(limit = 30, filiais = null) {
      try {
        await initializeAuth();
        const params = new URLSearchParams();
        params.append('debug', '1');
        params.append('limit', String(limit));
        const url = `/nps_sync_api_pedidos_vendas_recentes.php?${params.toString()}`;
        console.log(`\n🧭 Tentando endpoint alternativo: ${process.env.API_BASE_URL || 'http://192.168.10.112:8000'}${url}`);
        const r = await apiClient.get(url);
        console.log('✅ Alt status:', r.status);
        const d = r.data;
        console.log('   tipo:', Array.isArray(d) ? 'array' : typeof d);
        if (Array.isArray(d)) {
          console.log('   count:', d.length);
          if (d.length) console.log('   Primeiro:', d[0]);
        } else {
          console.log('   body:', JSON.stringify(d, null, 2));
        }

        // Após alt, tenta endpoint principal com janela maior
        const qs = new URLSearchParams();
        qs.append('minutos', '180');
        qs.append('limit', '50');
        const normalUrl = `/nps_sync_api_pedidos_vendas_recentes.php?${qs.toString()}`;
        console.log(`\n⏱️ Tentando endpoint principal após alt: ${process.env.API_BASE_URL || 'http://192.168.10.112:8000'}${normalUrl}`);
        const rnorm = await apiClient.get(normalUrl);
        console.log('✅ Principal status:', rnorm.status);
        console.log('   count:', rnorm.data?.count);
        if (rnorm.data?.pedidos?.length) {
          console.log('   Primeiro pedido:', rnorm.data.pedidos[0]);
        }
      } catch (e) {
        const st = e.response?.status;
        const bd = e.response?.data;
        console.error(`❌ Falha no endpoint alternativo (${st ?? 'sem status'})`, bd || e.message);
      }
    })();
  }
})();