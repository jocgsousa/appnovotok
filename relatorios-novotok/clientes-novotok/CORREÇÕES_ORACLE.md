# Correções na Query Oracle - Relatórios Clientes

## Problemas Identificados e Corrigidos

### 1. **Query SQL Incompleta**
**Problema:** A query implementada no backend estava muito simplificada comparada à query original.

**Correção:** Substituída a query no arquivo `backend/config/oracleService.js` para corresponder exatamente à query original, incluindo:
- Cálculo completo do VLVENDA com VLSUBTOTITEM, TRUNCARITEM, VLOUTRASDESP, VLFRETE
- Adição dos campos VLCUSTOFIN e TOTPESO
- Todos os JOINs necessários (PCUSUARI, PCDEPTO, PCSUPERV, PCPRACA)
- Condições WHERE completas

### 2. **Parâmetros com Nomes Incorretos**
**Problema:** Os nomes dos parâmetros não correspondiam aos esperados pela query.

**Correção:** Alterados os nomes dos parâmetros de:
- `dataInicio/dataFim` → `DATAINICIO/DATAFIM`
- `codFilial` → `FILIAL`
- `codDepto` → `CODEPTO`
- `codAtiv` → `ATIVIDADE`
- `codMarca` → `CODMARCA`
- `codProduto` → `CODPRODUTO`
- Adicionado `PRODUTOSCONSULTA`

### 3. **Formato de Data Incorreto**
**Problema:** Datas JavaScript não eram formatadas corretamente para Oracle.

**Correção:** 
- Adicionado método `formatDateForOracle()` no controller
- Datas agora são formatadas como DD/MM/YYYY
- Adicionado logging para debug dos parâmetros

### 4. **JOINs e Estrutura da Query**
**Problema:** Faltavam várias tabelas e JOINs essenciais.

**Correção:** Adicionados todos os JOINs da query original:
- PCUSUARI (usuários)
- PCDEPTO (departamentos)
- PCSUPERV (supervisores)
- PCPRACA (praças)
- Corrigidos tipos de JOIN (LEFT JOIN vs JOIN)

### 5. **Condições WHERE Incompletas**
**Problema:** Muitas condições importantes estavam faltando.

**Correção:** Adicionadas todas as condições:
- Filtro de telefones válidos
- Verificação de pedidos não cancelados
- Condições de venda específicas
- Filtros de data em ambas as tabelas (PCPEDC e PCPEDI)
- Suporte a múltiplos valores em FILIAL e CODMARCA

## Arquivos Modificados

1. **`backend/config/oracleService.js`**
   - Método `executeClientQuery()` completamente reescrito
   - Query SQL atualizada para corresponder ao original
   - Parâmetros renomeados
   - Adicionado logging para debug

2. **`backend/controllers/OracleController.js`**
   - Adicionado método `formatDateForOracle()`
   - Correção no processamento de datas

## Como Testar

1. **Reiniciar o servidor backend:**
   ```bash
   cd backend
   npm start
   ```

2. **Testar conexão Oracle:**
   - Usar o botão "Testar Conexão" na interface
   - Verificar logs do servidor

3. **Executar consulta com filtros de data:**
   - Definir período de datas
   - Verificar se retorna dados
   - Observar logs no console do servidor

4. **Testar filtros específicos:**
   - Departamento
   - Atividade
   - Marca
   - Filial
   - Código do produto

## Logs para Debug

O sistema agora inclui logs detalhados:
- Filtros recebidos do frontend
- Parâmetros formatados para Oracle
- Erros de execução da query

## Próximos Passos

Se ainda houver problemas:
1. Verificar logs do servidor para erros específicos
2. Confirmar se as tabelas Oracle existem e têm dados
3. Validar permissões do usuário POWERBI no Oracle
4. Testar query diretamente no Oracle SQL Developer