# Clientes NovoTok - Backend API

Backend API desenvolvida em Node.js + Express + Sequelize + MySQL para o sistema Clientes NovoTok.

## 📋 Pré-requisitos

- Node.js (versão 16 ou superior)
- MySQL (versão 5.7 ou superior)
- npm ou yarn

## 🚀 Instalação e Configuração

### 1. Instalação das dependências
```bash
npm install
```

### 2. Configuração do banco de dados

1. Certifique-se de que o MySQL está rodando
2. Configure as variáveis de ambiente no arquivo `.env` (já configurado para localhost)
3. Execute o script de setup:

```bash
# Windows
scripts\\setup-database.bat

# Ou manualmente:
npm run db:create
npm run db:migrate
npm run db:seed
```

### 3. Iniciando o servidor de desenvolvimento

```bash
# Windows
scripts\\start-dev.bat

# Ou manualmente:
npm run dev
```

O servidor estará disponível em: http://localhost:3001

## 📚 Endpoints da API

### Usuários

- `POST /api/users` - Criar usuário
- `GET /api/users` - Listar usuários (com paginação)
- `GET /api/users/:id` - Buscar usuário por ID
- `PUT /api/users/:id` - Atualizar usuário
- `DELETE /api/users/:id` - Excluir usuário (soft delete)
- `POST /api/users/login` - Login do usuário
- `PUT /api/users/:id/change-password` - Alterar senha

### Outros

- `GET /api/health` - Health check
- `GET /` - Informações da API

## 🔐 Usuário Padrão

Após executar os seeders, um usuário administrador será criado:

- **Email:** admin@novotok.com
- **Senha:** admin123

## 🛠️ Scripts Disponíveis

- `npm run dev` - Inicia servidor de desenvolvimento
- `npm start` - Inicia servidor de produção
- `npm run db:create` - Cria o banco de dados
- `npm run db:migrate` - Executa migrations
- `npm run db:seed` - Executa seeders
- `npm run db:reset` - Reseta o banco (drop + create + migrate + seed)

## 📁 Estrutura do Projeto

```
backend/
├── config/          # Configurações (database, etc)
├── controllers/     # Controladores
├── middleware/      # Middlewares
├── migrations/      # Migrations do banco
├── models/          # Modelos Sequelize
├── routes/          # Rotas da API
├── scripts/         # Scripts auxiliares
├── seeders/         # Seeders do banco
├── .env             # Variáveis de ambiente
├── .sequelizerc     # Configuração Sequelize CLI
├── package.json     # Dependências e scripts
└── server.js        # Servidor principal
```

## 🔧 Configuração do Banco

O sistema está configurado para MySQL com as seguintes configurações padrão:

- **Host:** localhost
- **Porta:** 3306
- **Usuário:** root
- **Senha:** (vazia)
- **Database:** clientes_novotok

Para alterar essas configurações, edite o arquivo `.env`.

## 🔄 Reset do Banco de Dados

Para resetar completamente o banco de dados:

```bash
# Windows
scripts\\reset-database.bat

# Ou manualmente:
npm run db:reset
```

## 📝 Logs

O servidor exibe logs detalhados no console, incluindo:
- Requisições HTTP
- Conexão com banco de dados
- Erros e exceções

## 🚨 Troubleshooting

### Erro de conexão com MySQL
- Verifique se o MySQL está rodando
- Confirme as credenciais no arquivo `.env`
- Teste a conexão manual: `mysql -u root -p`

### Erro de migrations
- Verifique se o banco de dados foi criado
- Execute `npm run db:create` antes das migrations

### Porta em uso
- Altere a porta no arquivo `.env` (variável PORT)
- Ou termine o processo que está usando a porta 3001