# Extrator de Produtos Novotok

Este script Node.js extrai códigos de produtos de um arquivo Excel e busca informações detalhadas no banco de dados Oracle, gerando um novo arquivo Excel com os resultados.

## Funcionalidades

- Lê códigos de produtos do arquivo `codigos.txt`
- Conecta ao banco de dados Oracle usando configurações do `oracle.json`
- Executa consulta SQL para obter dados de estoque e pedidos por filial
- Gera arquivo Excel `produtos_resultado.xlsx` com os resultados

## Pré-requisitos

- Node.js instalado
- Oracle Instant Client (já incluído na pasta `instantclient_19_25`)
- Acesso ao banco de dados Oracle configurado

## Instalação

1. Instale as dependências:
```bash
npm install
```

## Configuração

### Arquivo oracle.json
Contém as configurações de conexão com o banco Oracle:
```json
{
    "host": "192.168.10.85:1521",
    "user": "POWERBI",
    "password": "p0w3b123",
    "database": "WINT",
    "connectionLimit": 10,
    "multipleStatements": true
}
```

### Arquivo codigos.txt
Deve conter os códigos dos produtos (um por linha). O script irá:
- Ler cada linha do arquivo
- Extrair códigos únicos
- Ignorar linhas vazias

## Uso

Execute o script:
```bash
npm start
```

ou

```bash
node index.js
```

## Saída

O script gera um arquivo `produtos_resultado.xlsx` com as seguintes colunas:

- **CODPROD**: Código do produto
- **DESCRICAO**: Descrição do produto
- **ESTOQUE_ATUAL_1 a 8**: Estoque atual por filial (1-8)
- **QTPEDIDA_1 a 8**: Quantidade pedida por filial (1-8)

## Estrutura do Projeto

```
produtos-novotok/
├── instantclient_19_25/     # Oracle Instant Client
├── oracle.json              # Configurações do banco
├── produto.sql              # Query SQL de exemplo
├── produtos.xls             # Arquivo Excel de entrada
├── package.json             # Dependências do projeto
├── index.js                 # Script principal
├── README.md                # Esta documentação
└── produtos_resultado.xlsx  # Arquivo gerado (após execução)
```

## Logs

O script exibe logs detalhados durante a execução:
- Número de códigos encontrados no Excel
- Progresso do processamento
- Número de registros encontrados
- Caminho do arquivo gerado

## Tratamento de Erros

- Códigos não encontrados no banco são ignorados
- Erros de conexão são reportados
- Arquivo Excel inválido gera erro descritivo
- Conexão é sempre fechada ao final

## Dependências

- **oracledb**: Cliente Oracle para Node.js
- **xlsx**: Biblioteca para manipulação de arquivos Excel