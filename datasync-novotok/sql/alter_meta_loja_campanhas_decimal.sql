-- Migração: ajustar coluna quantidade_vendida para DECIMAL(15,2)
-- Use este script para bancos já existentes, evitando recriar tabelas.

ALTER TABLE meta_loja_campanhas 
  MODIFY quantidade_vendida DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Verificação (opcional):
-- SHOW COLUMNS FROM meta_loja_campanhas LIKE 'quantidade_vendida';