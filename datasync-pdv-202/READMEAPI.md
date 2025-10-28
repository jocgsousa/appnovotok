# API Backend - Documentação das Rotas

Este documento descreve todas as rotas disponíveis na API backend do sistema de sincronização de dados.

## URL Base
```
http://localhost:3001
```

## Middleware

### Logging
Todas as requisições são automaticamente logadas com:
- Timestamp
- Método HTTP
- URL
- User-Agent
- Parâmetros de consulta
- Corpo da requisição
- Status da resposta
- Duração da requisição
- Dados da resposta

### CORS
CORS habilitado para todas as rotas.

### JSON Parser
Parser JSON habilitado para processar requisições com `Content-Type: application/json`.

## Rotas da API

### 1. Gerenciamento de Caixas

#### GET `/api/caixas`
**Descrição:** Carrega as configurações de todos os caixas.

**Resposta de Sucesso:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "nome": "string",
      "LCDBHOST": "string",
      "LCDBUSER": "string",
      "LCDBPASS": "string",
      "LCDBNAME": "string",
      "FILIAL": "string",
      "CAIXA": "string",
      "MILISSEGUNDOS": number,
      "SYNC_INTERVAL": number,
      "selected": boolean
    }
  ]
}
```

**Resposta de Erro:**
```json
{
  "success": false,
  "error": "Mensagem de erro"
}
```

#### POST `/api/caixas`
**Descrição:** Salva as configurações dos caixas.

**Corpo da Requisição:**
```json
[
  {
    "id": "string",
    "nome": "string",
    "LCDBHOST": "string",
    "LCDBUSER": "string",
    "LCDBPASS": "string",
    "LCDBNAME": "string",
    "FILIAL": "string",
    "CAIXA": "string",
    "MILISSEGUNDOS": number,
    "SYNC_INTERVAL": number,
    "selected": boolean
  }
]
```

**Resposta de Sucesso:**
```json
{
  "success": true
}
```

**Resposta de Erro:**
```json
{
  "success": false,
  "error": "Mensagem de erro"
}
```

### 2. Controle de Sincronização

#### POST `/api/sync/start`
**Descrição:** Inicia a sincronização com os caixas selecionados.

**Corpo da Requisição:**
```json
{
  "selectedCaixas": [
    {
      "id": "string",
      "nome": "string",
      "LCDBHOST": "string",
      "LCDBUSER": "string",
      "LCDBPASS": "string",
      "LCDBNAME": "string",
      "FILIAL": "string",
      "CAIXA": "string",
      "MILISSEGUNDOS": number,
      "SYNC_INTERVAL": number
    }
  ],
  "globalConfig": {
    // Configurações globais opcionais
  }
}
```

**Resposta de Sucesso:**
```json
{
  "success": true
}
```

**Resposta de Erro:**
```json
{
  "success": false,
  "error": "Mensagem de erro"
}
```

**Códigos de Status:**
- `200`: Sincronização iniciada com sucesso
- `400`: Sincronização já em execução ou nenhum caixa selecionado
- `500`: Erro interno do servidor

#### POST `/api/sync/stop`
**Descrição:** Para a sincronização em execução.

**Resposta de Sucesso:**
```json
{
  "success": true
}
```

**Resposta de Erro:**
```json
{
  "success": false,
  "error": "Mensagem de erro"
}
```

**Códigos de Status:**
- `200`: Sincronização parada com sucesso
- `400`: Nenhuma sincronização em execução
- `500`: Erro interno do servidor

#### GET `/api/sync/status`
**Descrição:** Obtém o status atual da sincronização.

**Resposta:**
```json
{
  "running": boolean,
  "connectedCaixas": number,
  "hasToken": boolean
}
```

**Códigos de Status:**
- `200`: Status obtido com sucesso
- `500`: Erro interno (retorna status padrão)

### 3. Estatísticas da API

#### GET `/api/stats`
**Descrição:** Obtém as estatísticas da API.

**Resposta de Sucesso:**
```json
{
  // Objeto com estatísticas da API
  // Estrutura depende da implementação do MultiCaixaManager
}
```

**Resposta quando não há gerenciador ativo:**
```json
null
```

**Códigos de Status:**
- `200`: Estatísticas obtidas com sucesso
- `500`: Erro interno (retorna null)

#### POST `/api/stats/reset`
**Descrição:** Reseta as estatísticas da API.

**Resposta de Sucesso:**
```json
{
  "success": true
}
```

**Resposta de Erro:**
```json
{
  "success": false,
  "error": "Mensagem de erro"
}
```

**Códigos de Status:**
- `200`: Estatísticas resetadas com sucesso
- `400`: Manager não inicializado
- `500`: Erro interno do servidor

### 4. Teste de Conexão

#### POST `/api/test-connection`
**Descrição:** Testa a conexão com um caixa específico.

**Corpo da Requisição:**
```json
{
  "id": "string",
  "nome": "string",
  "LCDBHOST": "string",
  "LCDBUSER": "string",
  "LCDBPASS": "string",
  "LCDBNAME": "string",
  "FILIAL": "string",
  "CAIXA": "string"
}
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  // Dados adicionais do resultado do teste
}
```

**Resposta de Erro:**
```json
{
  "success": false,
  "error": "Mensagem de erro"
}
```

**Códigos de Status:**
- `200`: Teste executado (sucesso ou falha)
- `500`: Erro interno do servidor

## Tratamento de Erros

Todos os erros não capturados são tratados por um middleware global que:
- Loga o erro completo com stack trace
- Retorna uma resposta padronizada de erro interno
- Define o status HTTP como 500

**Resposta de Erro Global:**
```json
{
  "success": false,
  "error": "Erro interno do servidor"
}
```

## Logs

O sistema possui um sistema de logging detalhado que categoriza as mensagens com emojis:

- 🔍 **[CAIXAS]**: Operações relacionadas aos caixas
- 🚀 **[SYNC]**: Operações de sincronização
- 📊 **[STATUS]**: Consultas de status
- 📈 **[STATS]**: Operações de estatísticas
- 🔌 **[TEST]**: Testes de conexão
- 🚨 **[ERROR]**: Erros do sistema
- 🚀 **[SERVER]**: Inicialização do servidor

## Configuração

### Variáveis de Ambiente
- `PORT`: Porta do servidor (padrão: 3001)

### Arquivos de Configuração
- `caixas-config.json`: Arquivo de configuração dos caixas (localizado na raiz do projeto)

## Dependências

- **express**: Framework web
- **cors**: Middleware para CORS
- **fs**: Sistema de arquivos (nativo do Node.js)
- **path**: Manipulação de caminhos (nativo do Node.js)
- **MultiCaixaManager**: Gerenciador customizado de múltiplos caixas

## Inicialização

O servidor é iniciado na porta configurada (padrão 3001) e exibe informações detalhadas sobre:
- Status de inicialização
- Porta utilizada
- URL de acesso
- Localização do arquivo de configuração
- Status dos logs detalhados