# Dashboard Busca Preço

Este é o painel administrativo do sistema Busca Preço, desenvolvido em React com TypeScript. O dashboard permite gerenciar aparelhos, ramos de atividades, vendedores e configurações da conta.

## Funcionalidades

- **Autenticação**: Sistema de login seguro com JWT
- **Gerenciamento de Aparelhos**: Visualizar, autorizar, bloquear e excluir aparelhos
- **Ramos de Atividades**: Cadastrar e gerenciar ramos de atividades para clientes
- **Vendedores**: Cadastrar e gerenciar vendedores (RCAs) com controle de status
- **Minha Conta**: Gerenciar informações do usuário administrador

## Tecnologias Utilizadas

- React 18
- TypeScript
- React Router Dom
- Axios
- React Bootstrap
- Bootstrap Icons

## Estrutura do Projeto

```
dashboard-buscapreco/
├── src/
│   ├── components/     # Componentes reutilizáveis
│   │   ├── Aparelhos.tsx
│   │   ├── MinhaConta.tsx
│   │   ├── RamosAtividades.tsx
│   │   ├── Vendedores.tsx
│   │   └── PrivateRoute.tsx
│   ├── pages/          # Páginas principais
│   │   ├── Dashboard.tsx
│   │   └── Login.tsx
│   ├── services/       # Serviços de API
│   │   ├── api.ts
│   │   ├── authService.ts
│   │   └── vendedorService.ts
│   ├── App.tsx         # Componente principal
│   └── index.tsx       # Ponto de entrada
```

## Instalação e Execução

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/dashboard-buscapreco.git
cd dashboard-buscapreco
```

2. Instale as dependências:
```bash
npm install
```

3. Configure a URL da API no arquivo `src/services/api.ts`

4. Execute o projeto:
```bash
npm start
```

5. Acesse o dashboard em `http://localhost:3000`

## Endpoints da API

O dashboard se comunica com os seguintes endpoints da API:

- `/login.php` - Autenticação de usuários
- `/register_index.php` - Obter dados do usuário
- `/register_update.php` - Atualizar dados do usuário
- `/listar_aparelho.php` - Listar aparelhos
- `/autorizar_aparelho.php` - Autorizar aparelho
- `/bloquear_aparelho.php` - Bloquear aparelho
- `/deletar_aparelho.php` - Deletar aparelho
- `/listar_ativi.php` - Listar ramos de atividades
- `/register_ativi.php` - Cadastrar ramo de atividade
- `/deletar_ativi.php` - Deletar ramo de atividade
- `/listar_vendedores.php` - Listar vendedores
- `/cadastrar_vendedor.php` - Cadastrar vendedor
- `/atualizar_status_vendedor.php` - Atualizar status do vendedor
- `/deletar_vendedor.php` - Deletar vendedor

## Requisitos para o Backend

Para que o dashboard funcione corretamente, é necessário implementar os endpoints mencionados acima no backend PHP. Certifique-se de que o backend esteja configurado para:

1. Autenticação via JWT
2. Permitir requisições CORS do frontend
3. Implementar todos os endpoints necessários

## Credenciais de Teste

- **Email**: admin@gmail.com
- **Senha**: 123456
