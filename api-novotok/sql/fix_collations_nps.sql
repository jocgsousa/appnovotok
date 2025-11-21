-- Unifica collations para evitar erros "Illegal mix of collations" no '='
-- Escolha: utf8mb4 + utf8mb4_unicode_ci para comparações corretas de acentuação

-- 1) Ajustar collation padrão do banco (não altera colunas existentes)
-- Substitua `SEU_BANCO` pelo nome do banco configurado em api-novotok/config.php
ALTER DATABASE `SEU_BANCO` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2) Converter tabelas relevantes para utf8mb4_unicode_ci
-- CONVERT TO CHARACTER SET aplica em todas colunas textuais (CHAR/VARCHAR/TEXT)
ALTER TABLE `controle_envios_nps` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `respostas_nps`      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `campanhas_nps`      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `pedidos_vendas`     CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `vendedores`         CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `estado_conversa_nps` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3) Verificação: liste collations de colunas após conversão
SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'SEU_BANCO'
  AND TABLE_NAME IN ('controle_envios_nps','respostas_nps','campanhas_nps','pedidos_vendas','vendedores','estado_conversa_nps')
ORDER BY TABLE_NAME, COLUMN_NAME;

-- Observações:
-- - Execute fora do horário de pico: operações podem reindexar e bloquear tabelas.
-- - Faça backup prévio e teste em staging.
-- - Se houver triggers/foreign keys, a conversão mantém integridade; revise collation de chaves estrangeiras e índices.
-- - Caso alguma coluna use um collation específico, ajuste manualmente com:
--   ALTER TABLE `tabela` MODIFY `coluna` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;