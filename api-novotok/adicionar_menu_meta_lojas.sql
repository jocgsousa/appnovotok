-- Script para adicionar o menu Meta de Lojas ao sistema
-- Execute este script no banco de dados para adicionar o menu Meta de Lojas

-- Inserir o menu Meta de Lojas
INSERT INTO menus (nome, descricao, icone, rota, ordem, ativo) VALUES
('Meta de Lojas', 'Gestão de metas de lojas', 'shop', '/meta-lojas', 16, 1);

-- Obter o ID do menu recém-criado e adicionar permissões para o usuário admin
SET @menu_id = LAST_INSERT_ID();

-- Inserir permissões para o usuário admin (ID = 1) com acesso total ao novo menu
INSERT INTO permissoes_usuarios (usuario_id, menu_id, visualizar, criar, editar, excluir) 
VALUES (1, @menu_id, 1, 1, 1, 1);

-- Verificar se o menu foi inserido corretamente
SELECT * FROM menus WHERE nome = 'Meta de Lojas';

-- Verificar se as permissões foram inseridas corretamente
SELECT p.*, m.nome as menu_nome 
FROM permissoes_usuarios p 
JOIN menus m ON p.menu_id = m.id 
WHERE p.usuario_id = 1 AND m.nome = 'Meta de Lojas';