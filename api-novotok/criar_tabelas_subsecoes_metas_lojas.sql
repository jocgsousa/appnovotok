-- Script para criar tabelas das subseções de metas de lojas
-- Baseado na análise do componente MetaLojas.tsx

-- Tabela para operadoras de caixa
CREATE TABLE IF NOT EXISTS meta_loja_operadoras_caixa (
    id VARCHAR(50) PRIMARY KEY,
    meta_loja_id VARCHAR(50) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    funcao VARCHAR(50) NOT NULL DEFAULT 'OPERADOR(A) DE CAIXA',
    cadastros_positivados INT NOT NULL DEFAULT 0,
    produtos_destaque INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meta_loja_id) REFERENCES metas_lojas(id) ON DELETE CASCADE
);

-- Tabela para vendedoras
CREATE TABLE IF NOT EXISTS meta_loja_vendedoras (
    id VARCHAR(50) PRIMARY KEY,
    meta_loja_id VARCHAR(50) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    funcao VARCHAR(50) NOT NULL DEFAULT 'ATENDENTE DE LOJA',
    valor_vendido_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    esmaltes INT NOT NULL DEFAULT 0,
    profissional_parceiras INT NOT NULL DEFAULT 0,
    valor_vendido_make DECIMAL(15,2) NOT NULL DEFAULT 0,
    quantidade_malka INT NOT NULL DEFAULT 0,
    valor_malka DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meta_loja_id) REFERENCES metas_lojas(id) ON DELETE CASCADE
);

-- Tabela para vendedoras bijou
CREATE TABLE IF NOT EXISTS meta_loja_vendedoras_bijou (
    id VARCHAR(50) PRIMARY KEY,
    meta_loja_id VARCHAR(50) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    funcao VARCHAR(50) NOT NULL DEFAULT 'VENDEDORA BIJOU/MAKE/BOLSAS',
    bijou_make_bolsas INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meta_loja_id) REFERENCES metas_lojas(id) ON DELETE CASCADE
);

-- Tabela para gerente
CREATE TABLE IF NOT EXISTS meta_loja_gerente (
    id VARCHAR(50) PRIMARY KEY,
    meta_loja_id VARCHAR(50) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    funcao VARCHAR(50) NOT NULL DEFAULT 'GERENTE',
    percentual_meta_geral DECIMAL(5,4) NOT NULL DEFAULT 0.08,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meta_loja_id) REFERENCES metas_lojas(id) ON DELETE CASCADE,
    UNIQUE KEY unique_gerente_meta (meta_loja_id)
);

-- Tabela para campanhas
CREATE TABLE IF NOT EXISTS meta_loja_campanhas (
    id VARCHAR(50) PRIMARY KEY,
    meta_loja_id VARCHAR(50) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    quantidade_vendida INT NOT NULL DEFAULT 0,
    atingiu_meta BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meta_loja_id) REFERENCES metas_lojas(id) ON DELETE CASCADE
);

-- Tabela para metas de produtos (usada por operadoras, vendedoras e vendedoras bijou)
CREATE TABLE IF NOT EXISTS meta_loja_produtos (
    id VARCHAR(50) PRIMARY KEY,
    meta_loja_id VARCHAR(50) NOT NULL,
    funcionario_id VARCHAR(50) NOT NULL,
    tipo_funcionario ENUM('operadora', 'vendedora', 'vendedoraBijou') NOT NULL,
    nome_produto_marca VARCHAR(200) NOT NULL,
    qtd_meta INT NOT NULL DEFAULT 0,
    qtd_vendido INT NOT NULL DEFAULT 0,
    percentual_sobre_venda DECIMAL(5,2) NOT NULL DEFAULT 0,
    valor_vendido DECIMAL(15,2) NOT NULL DEFAULT 0,
    valor_comissao DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meta_loja_id) REFERENCES metas_lojas(id) ON DELETE CASCADE
);

-- Tabela para funcionários legados (mantida para compatibilidade)
CREATE TABLE IF NOT EXISTS meta_loja_funcionarios (
    id VARCHAR(50) PRIMARY KEY,
    meta_loja_id VARCHAR(50) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    funcao VARCHAR(50) NOT NULL,
    cadastros INT NOT NULL DEFAULT 0,
    produtos_destaque INT NOT NULL DEFAULT 0,
    valor_vendido_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    esmaltes INT NOT NULL DEFAULT 0,
    profissional_parceiras INT NOT NULL DEFAULT 0,
    percentual_profissional DECIMAL(5,2) NOT NULL DEFAULT 2,
    valor_vendido_make DECIMAL(15,2) NOT NULL DEFAULT 0,
    quantidade_malka INT NOT NULL DEFAULT 0,
    valor_malka DECIMAL(15,2) NOT NULL DEFAULT 0,
    bijou_make_bolsas INT NOT NULL DEFAULT 0,
    comissao_esmaltes DECIMAL(15,2) NOT NULL DEFAULT 0,
    comissao_profissional_parceiras DECIMAL(15,2) NOT NULL DEFAULT 0,
    comissao_valor_vendido_make DECIMAL(15,2) NOT NULL DEFAULT 0,
    comissao_quantidade_malka DECIMAL(15,2) NOT NULL DEFAULT 0,
    comissao_valor_malka DECIMAL(15,2) NOT NULL DEFAULT 0,
    comissao_bijou_make_bolsas DECIMAL(15,2) NOT NULL DEFAULT 0,
    comissao_valor_vendido_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    comissao_cadastros DECIMAL(15,2) NOT NULL DEFAULT 0,
    comissao_produtos_destaque DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meta_loja_id) REFERENCES metas_lojas(id) ON DELETE CASCADE
);

-- Adicionar campo valor_venda_loja_total na tabela principal
ALTER TABLE metas_lojas ADD COLUMN IF NOT EXISTS valor_venda_loja_total DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_meta_loja_operadoras_meta_id ON meta_loja_operadoras_caixa(meta_loja_id);
CREATE INDEX IF NOT EXISTS idx_meta_loja_vendedoras_meta_id ON meta_loja_vendedoras(meta_loja_id);
CREATE INDEX IF NOT EXISTS idx_meta_loja_vendedoras_bijou_meta_id ON meta_loja_vendedoras_bijou(meta_loja_id);
CREATE INDEX IF NOT EXISTS idx_meta_loja_campanhas_meta_id ON meta_loja_campanhas(meta_loja_id);
CREATE INDEX IF NOT EXISTS idx_meta_loja_produtos_meta_id ON meta_loja_produtos(meta_loja_id);
CREATE INDEX IF NOT EXISTS idx_meta_loja_produtos_funcionario ON meta_loja_produtos(funcionario_id, tipo_funcionario);
CREATE INDEX IF NOT EXISTS idx_meta_loja_funcionarios_meta_id ON meta_loja_funcionarios(meta_loja_id);