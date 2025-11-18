require('dotenv').config({ override: true });
const axios = require('axios');

function arg(key, def) {
  const idx = process.argv.findIndex(a => a === `--${key}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return def;
}

(async () => {
  const di = arg('di', '2025-10-01');
  const df = arg('df', '2025-10-31');
  const codusur = arg('codusur', '108');
  const api = process.env.API_URL;
  if (!api) {
    console.error('API_URL não definido no .env');
    process.exit(1);
  }

  const login = await axios.post(`${api}/login.php`, {
    email: 'admin@gmail.com',
    password: '@Ntkti1793'
  });
  const token = login.data && login.data.token;
  if (!token) {
    console.error('Falha ao obter token');
    process.exit(1);
  }

  const query = `SELECT id,codusur,nome,data_inicio,data_fim,total_qtd_pedidos,total_media_itens,total_ticket_medio,total_vlcustofin,total_qtcliente,total_via,total_vlvendadodia,total_vldevolucao,total_valor,created_at,updated_at FROM vendas_totais WHERE data_inicio='${di}' AND data_fim='${df}' AND codusur='${codusur}'`;
  const resp = await axios.post(`${api}/executar_consulta.php`, { query }, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log(JSON.stringify(resp.data, null, 2));
})().catch(err => {
  const data = err.response ? err.response.data : err.message;
  console.error('Erro:', typeof data === 'string' ? data : JSON.stringify(data));
  process.exit(1);
});