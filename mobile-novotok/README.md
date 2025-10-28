# Busca Preço - Aplicativo de Consulta de Preços

Este aplicativo permite consultar preços de produtos através da leitura de códigos de barras e gerenciar clientes.

## Melhorias Implementadas

### Frontend

1. **Nova Estrutura de Navegação**
   - Implementado menu inferior com React Navigation
   - Telas separadas para Home, Ofertas, Novo Cliente e Configurações
   - Navegação por pilha para login e menu principal

2. **Nova Identidade Visual**
   - Cores atualizadas de roxo (#9502A2) para vermelho (#f12b00)
   - Layout mais moderno e intuitivo
   - Melhor organização dos elementos na tela

3. **Autenticação**
   - Tela de login para RCAs (vendedores)
   - Armazenamento seguro de token JWT
   - Controle de acesso às funcionalidades

4. **Configurações**
   - Modal para configuração da URL da API
   - Opções para sincronização de dados
   - Gerenciamento de cache para uso offline

### Backend

1. **Sistema de Autenticação**
   - Endpoint para login de vendedores
   - Tabela de vendedores no banco de dados
   - Geração e validação de tokens JWT

## Estrutura do Projeto

### Frontend

```
frontend-buscapreco/
├── src/
│   ├── components/     # Componentes reutilizáveis
│   ├── contexts/       # Contextos React (AuthContext)
│   ├── navigation/     # Configuração de navegação
│   ├── screens/        # Telas do aplicativo
│   ├── services/       # Serviços de API
│   └── utils/          # Funções utilitárias
├── assets/             # Imagens e recursos estáticos
├── App.tsx             # Componente principal
└── index.ts            # Ponto de entrada
```

### Backend

```
api-buscapreco/
├── cors_config.php           # Configuração de CORS
├── database.php              # Conexão com o banco de dados
├── jwt_utils.php             # Utilitários para JWT
├── login_vendedor.php        # Endpoint de login para vendedores
├── create_vendedores_table.php # Script para criar tabela de vendedores
└── ... (outros arquivos)
```

## Funcionalidades

- **Busca de Produtos**: Consulta de preços por código de barras
- **Modo Offline**: Sincronização de produtos para uso sem internet
- **Ofertas**: Visualização de produtos em oferta
- **Cadastro de Clientes**: Formulário para cadastro de novos clientes
- **Configurações**: Personalização do aplicativo e sincronização de dados

## Instalação e Execução

### Frontend

```bash
cd frontend-buscapreco
yarn install
yarn dev
```

### Backend

1. Configure seu servidor web (Apache, Nginx) para apontar para a pasta `api-buscapreco`
2. Importe o banco de dados ou execute o script `create_vendedores_table.php`
3. Acesse a API através da URL configurada

## Credenciais de Teste

- **RCA**: 123456
- **Senha**: 123456
