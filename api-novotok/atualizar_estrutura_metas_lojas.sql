-- Script para atualizar a estrutura da tabela metas_lojas
-- Este script corrige a incompatibilidade entre a estrutura no database.sql e o código PHP

-- Primeiro, fazer backup da tabela existente (se houver dados)
CREATE TABLE IF NOT EXISTS metas_lojas_backup AS SELECT * FROM metas_lojas;

-- Remover a tabela existente
DROP TABLE IF EXISTS metas_lojas;

-- Criar a nova estrutura da tabela metas_lojas compatível com o código PHP
CREATE TABLE IF NOT EXISTS metas_lojas (
    id VARCHAR(50) PRIMARY KEY,
    loja_id VARCHAR(50) NOT NULL,
    nome_loja VARCHAR(100) NOT NULL,
    mes INT NOT NULL COMMENT 'Mês da meta (1-12)',
    ano INT NOT NULL COMMENT 'Ano da meta',
    grupo_meta_id VARCHAR(50) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT 1,
    data_criacao DATE NOT NULL DEFAULT (CURRENT_DATE),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (grupo_meta_id) REFERENCES grupos_metas_produtos(id) ON DELETE CASCADE,
    INDEX idx_loja_id (loja_id),
    INDEX idx_grupo_meta_id (grupo_meta_id),
    INDEX idx_periodo (mes, ano),
    UNIQUE KEY unique_loja_periodo (loja_id, mes, ano)
);

-- Verificar se a tabela foi criada corretamente
DESCRIBE metas_lojas;

-- Inserir um grupo de metas de exemplo para teste
INSERT IGNORE INTO grupos_metas_produtos (id, nome, descricao, ativo) VALUES
('1', 'Grupo Meta Padrão', 'Grupo de metas padrão para testes', 1);

-- Verificar se o grupo foi inserido
SELECT * FROM grupos_metas_produtos WHERE id = '1';