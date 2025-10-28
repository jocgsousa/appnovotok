# DataSync NovoTok - Sistema Completo de Sincronização

Este projeto é o núcleo de sincronização e automação do sistema NovoTok, contendo múltiplos módulos integrados:

## 📋 Componentes Principais

### 1. Sincronizador de Produtos (index.js)
Sincroniza dados de produtos entre o banco Oracle e o MySQL:
- Informações básicas do produto
- Preços e descontos de fidelidade
- Ofertas e promoções
- Execução agendada via cron jobs

### 2. Sincronizador de Vendas (index2.js)
Sincroniza dados de vendas entre Oracle e API NovoTok:
- Vendas diárias por vendedor
- Totais de vendas por período
- Métricas como ticket médio, quantidade de clientes
- Relatórios de performance

### 3. Sistema NPS (nps-sync.js)
Sistema completo de Net Promoter Score:
- Disparo automático de pesquisas NPS
- Processamento de respostas via WhatsApp
- Integração com campanhas e controle de envios
- Monitoramento de novos pedidos
- Consolidação de estados de conversa

### 4. Consolidador NPS (nps-consolidador.js)
Sistema independente de consolidação:
- Garante integridade entre tabelas NPS
- Recuperação automática de falhas
- Execução via cron jobs configuráveis
- Logs detalhados de operações

### 5. WhatsApp Manager (whatsapp-manager.js)
Gerenciador completo de instâncias WhatsApp:
- Controle local usando whatsapp-web.js
- Múltiplas instâncias simultâneas
- Geração automática de QR codes
- API REST para controle das instâncias
- Socket.IO para atualizações em tempo real
- Sessões persistentes por instância

### 6. API Client (api-client.js)
Cliente unificado para comunicação com APIs:
- Autenticação JWT automática
- Endpoints para NPS, campanhas e controles
- Tratamento de erros e retry automático
- Suporte a múltiplas APIs

### 7. Sistema de Autenticação (auth.js)
Gerenciamento de tokens e autenticação:
- Login automático via credenciais
- Renovação de tokens JWT
- Cache de autenticação
- Integração com todas as APIs

## 🛠️ Requisitos

- Node.js v16+
- Oracle Instant Client 19.25 (incluído)
- MySQL/MariaDB
- Acesso ao banco Oracle (WINT)
- WhatsApp Web (para instâncias)

## ⚙️ Configuração

1. **Instale as dependências:**
```bash
yarn install
# ou
npm install
```

2. **Configure o arquivo `.env`:**
```env
# Banco de Dados Externo (MySQL)
EXDBHOST=srv1549.hstgr.io
EXDBNAME=u875901804_novotok
EXDBUSER=u875901804_novotok
EXDBPASS=sua_senha

# Banco de Dados Local (Oracle)
LCDBHOST=192.168.10.85:1521
LCDBNAME=WINT
LCDBUSER=NOVOTOK
LCDBPASS=sua_senha

# APIs
API_URL=https://novotokapi.online/api/v1
API_BASE_URL=https://novotokapi.online/api/v1
WHATSAPP_MANAGER_URL=http://localhost:3001

# Credenciais de Login
USER_EMAIL=admin@gmail.com
USER_PASSWORD=sua_senha

# Agendamento (Cron)
SCHEDULE_TIMES=0 08 * * *,0 20 * * *

# Configurações NPS
NPS_MONITOR_INTERVAL_MS=120000
```

3. **Configure o banco de dados:**
```bash
# Execute o script SQL para criar as tabelas
mysql -u usuario -p database_name < database.sql
```

## 🚀 Execução

### Scripts Disponíveis:

```bash
# Sincronizador de produtos
yarn start
# ou
node index.js

# Sincronizador de vendas
node index2.js

# WhatsApp Manager
yarn zap
# ou
node whatsapp-manager.js

# Sistema NPS
yarn nps
# ou
node nps-sync.js
## Agendamento

- O sincronizador de produtos é executado nos horários definidos em `SCHEDULE_TIMES`
- O sincronizador de vendas é executado a cada 5 minutos

## Logs

Os logs são armazenados nos arquivos:
- `sync_log.txt` (para produtos)
- `sync_vendas_log.txt` (para vendas) 