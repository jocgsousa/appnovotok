const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente do .env local
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (_) {
  // segue sem .env
}

// Descobrir URL base da API
const API_BASE_URL = process.env.API_BASE_URL || process.env.API_URL || 'https://novotokapi.online/api/v1';

// Ler token do arquivo .auth_token ou da env AUTH_TOKEN
const tokenPath = path.join(__dirname, '.auth_token');
let token = '';
if (fs.existsSync(tokenPath)) {
  const raw = fs.readFileSync(tokenPath, 'utf8').trim();
  try {
    const parsed = JSON.parse(raw);
    token = parsed.token || parsed.access_token || parsed.jwt || '';
  } catch (_) {
    token = raw;
  }
} else {
  token = (process.env.AUTH_TOKEN || '').trim();
}

if (!token) {
  console.error('❌ Token não encontrado. Crie o arquivo ".auth_token" ou defina AUTH_TOKEN no ambiente.');
  process.exit(1);
}

async function testPedidosVendasRecentes() {
  const minutos = Number(process.env.NPS_MINUTOS_VENDAS_RECENTES || process.env.NPS_MINUTOS_RECENTES || 60);
  const limit = Number(process.env.NPS_TEST_LIMIT || 50);
  const filiaisList = (process.env.NPS_TEST_FILIAIS || '1,2,3,4,5,7,8');

  console.log('🔧 Configuração de teste:');
  console.log(`   API_BASE_URL = ${API_BASE_URL}`);
  console.log(`   minutos = ${minutos}`);
  console.log(`   limit = ${limit}`);
  console.log(`   filiaisList = ${filiaisList}`);

  const scenarios = [
    { name: 'Sem filiais (60 min)', params: { minutos, limit } },
    { name: 'Filiais CSV (60 min)', params: { minutos, limit, filiais: filiaisList } },
    { name: 'Filiais JSON (60 min)', params: { minutos, limit, filiais: `[${filiaisList}]` } },
    { name: 'Filiais array estilo PHP (60 min)', params: { minutos, limit, filiaisArray: filiaisList.split(',') } },
    { name: 'Janela 24h sem filiais', params: { minutos: 1440, limit } },
    { name: 'Janela 3 dias com filiais CSV', params: { minutos: 4320, limit, filiais: filiaisList } },
    { name: 'Janela 7 dias sem filiais', params: { minutos: 10080, limit } },
    { name: 'Debug: bypass temporal sem filiais', params: { debug: 1, limit } },
    { name: 'Debug: bypass temporal com filiais CSV', params: { debug: 1, filiais: '1,2,3,4,5,7,8', limit } },
  ];

  for (const sc of scenarios) {
    try {
      const searchParams = new URLSearchParams();
      if (sc.params.minutos) searchParams.append('minutos', sc.params.minutos);
      if (sc.params.limit) searchParams.append('limit', sc.params.limit);
      if (sc.params.filiais) searchParams.append('filiais', sc.params.filiais);
      if (sc.params.filiaisArray) {
        for (const f of sc.params.filiaisArray) {
          searchParams.append('filiais[]', f);
        }
      }

      const url = `${API_BASE_URL}/nps_sync_api_pedidos_vendas_recentes.php?${searchParams.toString()}`;
      console.log(`\n🔎 Cenário: ${sc.name}`);
      console.log(`➡️  GET ${url}`);
      console.log(`➡️  Headers: Authorization: Bearer <${String(token).slice(0, 8)}...>`);

      const resp = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });

      const data = resp.data;
      const arr = data?.pedidos || data?.data || (Array.isArray(data) ? data : []);
      console.log(`✅ Status: ${resp.status}`);
      console.log(`📦 Tipo de resposta: ${Array.isArray(arr) ? 'array' : typeof data}`);
      console.log(`📊 Registros: ${Array.isArray(arr) ? arr.length : 'n/a'}`);

      if (Array.isArray(arr) && arr.length > 0) {
        const first = arr[0];
        console.log('🧪 Exemplo do primeiro item:', {
          NUMPED: first?.NUMPED,
          CODFILIAL: first?.CODFILIAL,
          DATA: first?.DATA,
          VLTOTAL: first?.VLTOTAL,
          CODCLI: first?.CODCLI,
          CLIENTE: first?.CLIENTE,
          NUMCAIXA: first?.NUMCAIXA,
          CREATED_AT: first?.CREATED_AT,
        });
      } else {
        console.log('ℹ️  Sem registros retornados');
      }
    } catch (err) {
      const status = err.response?.status;
      const body = err.response?.data;
      console.error(`❌ Erro (${status ?? 'sem status'}) no cenário "${sc.name}":`, body || err.message);
    }
  }
}

async function callEndpoint(name, endpoint, params = {}) {
  try {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) searchParams.append(k, v);
    }
    const url = `${API_BASE_URL}/${endpoint}?${searchParams.toString()}`;
    console.log(`\n🔎 Endpoint alternativo: ${name}`);
    console.log(`➡️  GET ${url}`);
    const resp = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    const data = resp.data;
    const arr = data?.pedidos || data?.data || (Array.isArray(data) ? data : []);
    console.log(`✅ Status: ${resp.status}`);
    console.log(`📊 Registros: ${Array.isArray(arr) ? arr.length : 'n/a'}`);
    if (Array.isArray(arr) && arr.length > 0) {
      console.log('🧪 Exemplo do primeiro item:', arr[0]);
    }
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    console.error(`❌ Erro no endpoint "${name}" (${status ?? 'sem status'}):`, body || err.message);
  }
}

(async () => {
  await testPedidosVendasRecentes();
  // Testes comparativos com outros endpoints relacionados
  await callEndpoint('nps_sync_api_pedidos_recentes', 'nps_sync_api_pedidos_recentes.php', { minutos: 60, limit: 50 });
  await callEndpoint('nps_sync_api', 'nps_sync_api.php', { minutos: 60, limit: 50 });
})().catch(e => {
  console.error('❌ Erro inesperado no teste:', e);
  process.exit(1);
});