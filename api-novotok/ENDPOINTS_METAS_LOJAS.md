# Endpoints para Sistema de Metas de Lojas

Esta documentação descreve todos os endpoints implementados para suportar o componente `MetaLojas.tsx` do dashboard.

## Autenticação

Todos os endpoints requerem autenticação via JWT Bearer Token no header:
```
Authorization: Bearer {token}
```

## 1. Grupos de Metas de Produtos

### 1.1 Listar Grupos de Metas
- **Endpoint:** `GET /listar_grupos_metas.php`
- **Parâmetros opcionais:**
  - `ativo`: `true` ou `false`
  - `busca`: string para buscar por nome ou descrição
- **Resposta:** Lista de grupos com suas metas associadas

### 1.2 Cadastrar Grupo de Meta
- **Endpoint:** `POST /cadastrar_grupo_meta.php`
- **Body:**
```json
{
  "nome": "Grupo Exemplo",
  "descricao": "Descrição do grupo",
  "metas": [
    {
      "nomeProdutoMarca": "Produto A",
      "qtdMeta": 10,
      "percentualSobreVenda": 15.5
    }
  ],
  "ativo": true
}
```

### 1.3 Atualizar Grupo de Meta
- **Endpoint:** `PUT /atualizar_grupo_meta.php`
- **Body:** Mesmo formato do cadastro, incluindo `id`

### 1.4 Deletar Grupo de Meta
- **Endpoint:** `DELETE /deletar_grupo_meta.php?id={grupo_id}`

## 2. Metas de Lojas

### 2.1 Listar Metas de Lojas
- **Endpoint:** `GET /listar_metas_lojas.php`
- **Parâmetros opcionais:**
  - `loja_id`: ID da loja
  - `mes`: 1-12
  - `ano`: ano (ex: 2024)
  - `ativo`: `true` ou `false`
  - `busca`: string para buscar

### 2.2 Cadastrar Meta de Loja
- **Endpoint:** `POST /cadastrar_meta_loja.php`
- **Body:**
```json
{
  "loja_id": "loja_001",
  "nome_loja": "Loja Centro",
  "mes": 12,
  "ano": 2024,
  "grupo_meta_id": "grupo_id_123",
  "ativo": true
}
```

### 2.3 Atualizar Meta de Loja
- **Endpoint:** `PUT /atualizar_meta_loja.php`
- **Body:** Mesmo formato do cadastro, incluindo `id`

### 2.4 Deletar Meta de Loja
- **Endpoint:** `DELETE /deletar_meta_loja.php?id={meta_id}`

### 2.5 Finalizar Meta de Loja
- **Endpoint:** `PATCH /finalizar_meta_loja.php`
- **Body:**
```json
{
  "id": "meta_id_123"
}
```
- **Descrição:** Marca a meta como inativa (finalizada). Operação idempotente.
- **Resposta:**
```json
{
  "status": 1,
  "message": "Meta finalizada com sucesso.",
  "data": { "id": "meta_id_123", "ativo": false }
}
```

## 3. Funcionários

### 3.1 Operadoras de Caixa
- **Endpoint:** `GET /listar_operadoras_caixa.php`
- **Parâmetros opcionais:**
  - `ativo`: `true` ou `false`
  - `busca`: string para buscar por nome ou email

### 3.2 Vendedoras
- **Endpoint:** `GET /listar_vendedoras.php`
- **Parâmetros opcionais:** Mesmos da operadoras de caixa

### 3.3 Vendedoras Bijou
- **Endpoint:** `GET /listar_vendedoras_bijou.php`
- **Parâmetros opcionais:** Mesmos da operadoras de caixa

### 3.4 Gerentes
- **Endpoint:** `GET /listar_gerentes.php`
- **Parâmetros opcionais:** Mesmos da operadoras de caixa

## 4. Metas de Produtos Individuais

### 4.1 Listar Metas de Produtos de Funcionários
- **Endpoint:** `GET /listar_metas_produtos_funcionarios.php`
- **Parâmetros opcionais:**
  - `funcionario_id`: ID do funcionário
  - `tipo_funcionario`: `operadora_caixa`, `vendedora`, `vendedora_bijou`, `gerente`
  - `mes`: 1-12
  - `ano`: ano
  - `ativo`: `true` ou `false`
  - `busca`: string para buscar

## 5. Campanhas

### 5.1 Listar Campanhas
- **Endpoint:** `GET /listar_campanhas.php`
- **Parâmetros opcionais:**
  - `ativo`: `true` ou `false`
  - `mes`: 1-12
  - `ano`: ano
  - `busca`: string para buscar por nome ou descrição

## Códigos de Resposta

- **200:** Sucesso
- **201:** Criado com sucesso
- **400:** Dados inválidos
- **401:** Não autorizado
- **404:** Não encontrado
- **405:** Método não permitido
- **500:** Erro interno do servidor

## Formato de Resposta Padrão

```json
{
  "status": 1,
  "message": "Mensagem de sucesso",
  "data": [...],
  "total": 10
}
```

Em caso de erro:
```json
{
  "status": 0,
  "message": "Mensagem de erro"
}
```

## Validações Importantes

1. **Grupos de Metas:** Não podem ser deletados se estiverem sendo usados em metas de lojas
2. **Metas de Lojas:** Não pode haver duas metas para a mesma loja no mesmo período
3. **Períodos:** Mês deve estar entre 1-12, ano entre 2020-2050
4. **Grupos Inativos:** Não podem ser usados em novas metas de lojas

## Estrutura das Tabelas

As tabelas foram criadas no arquivo `database.sql` e incluem:
- `grupos_metas_produtos`
- `metas_produtos_grupo`
- `metas_lojas`
- `operadoras_caixa`
- `vendedoras`
- `vendedoras_bijou`
- `gerentes`
- `metas_produtos_funcionarios`
- `campanhas_metas`
- `funcionarios_metas_legado`