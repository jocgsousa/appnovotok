# Sistema de Relatórios - Clientes Novotok

Um sistema desktop construído com Electron.js para gerar relatórios de clientes conectando a uma base de dados Oracle.

## Funcionalidades

- ✅ **Interface moderna e limpa** (barra de título personalizada)
- ✅ **Controles de janela elegantes** (minimizar cinza, maximizar cinza, fechar rosa)
- ✅ **Sistema de busca inteligente** (produtos, filiais, departamentos, atividades)
- ✅ Conexão segura com Oracle Database
- ✅ Filtros avançados de pesquisa
- ✅ **Seleção de colunas para exportação** (checkboxes nos cabeçalhos)
- ✅ Exportação para Excel (.xlsx)
- ✅ **Validação de números de telefone** (apenas telefones válidos)
- ✅ **Remoção automática de registros duplicados**
- ✅ **Validação inteligente de datas** (sem auto-correção)
- ✅ Formatação automática de dados
- ✅ Visualização responsiva de resultados
- ✅ Teste de conexão com base de dados

## Pré-requisitos

- Node.js (versão 14 ou superior)
- Oracle Instant Client 19.25 (já incluído no projeto)
- Acesso à base de dados Oracle configurada

## Instalação

1. **Clone ou baixe o projeto**
2. **Instale as dependências:**
   ```bash
   npm install
   ```

## Configuração

### Base de Dados
As configurações da base de dados estão no arquivo `database.json`:
 

### Oracle Instant Client
O Oracle Instant Client está localizado na pasta `instantclient_19_25/` e é automaticamente configurado pela aplicação.

## Como Usar

### Iniciar a Aplicação
```bash
npm start
```

### Interface Principal

1. **Filtros de Pesquisa:**
   - **Data Início/Fim:** Período da consulta (obrigatório)
   - **Código do Produto:** Códigos separados por vírgula (com busca por nome)
   - **Departamento:** Seleção via lista
   - **Atividade:** Seleção via lista de ramos de atividade
   - **Marca:** Busca por nome de marca com indicação de status
   - **Filial:** Seleção via lista de filiais
   - **Produtos Consulta:** Produtos específicos para consulta

2. **Sistema de Busca Inteligente:**
   - **🔍 Produtos:** Digite o nome para buscar produtos por descrição
   - **🏢 Filiais:** Lista todas as filiais disponíveis
   - **🏢 Departamentos:** Lista todos os departamentos
   - **💼 Atividades:** Lista todos os ramos de atividade
   - **🏷️ Marcas:** Busca de marcas por nome com indicação de status ativo/inativo

3. **Ações Disponíveis:**
   - **Testar Conexão:** Verifica conectividade com a base de dados
   - **Pesquisar (Ctrl+Enter):** Executa a consulta
   - **Limpar (Esc):** Limpa todos os filtros
   - **Exportar para Excel (Ctrl+E):** Gera arquivo Excel

### Colunas do Relatório

O relatório retorna as seguintes informações:

- **Código do Cliente**
- **Nome do Cliente**
- **Código do Vendedor**
- **Telefone** (formatado e validado)
- **CGCENT**
- **Endereço**
- **Bairro**
- **Município**
- **Estado**
- **Vendedor 2**
- **Quantidade**
- **Valor de Venda** (formatado como moeda)
- **Custo Financeiro** (formatado como moeda)
- **Peso Total**

### 🔍 **Validação e Filtragem Automática**

- **Telefones Válidos**: Apenas telefones com 8 ou mais dígitos
- **Sem Duplicados**: Registros duplicados são automaticamente removidos
- **Formatação**: Números de telefone são formatados conforme o tamanho

## Tecnologias Utilizadas

- **Electron.js** - Framework para aplicações desktop
- **Node.js** - Runtime JavaScript
- **oracledb** - Driver Oracle para Node.js
- **ExcelJS** - Biblioteca para geração de arquivos Excel
- **HTML5/CSS3/JavaScript** - Interface do usuário

## Estrutura do Projeto

```
clientes-novotok/
├── main.js              # Processo principal do Electron
├── preload.js           # Script de segurança IPC
├── index.html           # Interface principal
├── styles.css           # Estilos da aplicação
├── app.js              # Lógica da interface
├── database.json       # Configurações da base de dados
├── package.json        # Dependências e scripts
├── instantclient_19_25/ # Oracle Instant Client
└── README.md           # Este arquivo
```

## Scripts Disponíveis

- `npm start` - Inicia a aplicação
- `npm install` - Instala dependências

## Resolução de Problemas

### Erro de Conexão Oracle
- Verifique se o Oracle Instant Client está na pasta correta
- Confirme as configurações em `database.json`
- Teste a conectividade de rede com o servidor Oracle

### Erro de Permissões
- Execute a aplicação como administrador se necessário
- Verifique permissões de escrita para exportação Excel

### Performance Lenta
- Reduza o período de consulta
- Use filtros mais específicos
- Verifique a performance da base de dados

## Suporte

Para suporte técnico ou dúvidas sobre o sistema, consulte a documentação da base de dados ou entre em contato com a equipe de desenvolvimento.

## Licença

Este projeto é de uso interno da Novotok.