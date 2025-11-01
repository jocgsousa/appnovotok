CREATE DATABASE IF NOT EXISTS novotok CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

USE NOVOTOK;

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE, -- Reduzido para 100 caracteres
    senha VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL UNIQUE, -- Reduzido para 11 caracteres
    telefone VARCHAR(20),
    tipo_usuario ENUM('admin', 'gestor', 'operador') NOT NULL DEFAULT 'operador',
    ativo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
  
-- Tabela para armazenar os menus do sistema
CREATE TABLE menus (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    descricao VARCHAR(255),
    icone VARCHAR(50),
    rota VARCHAR(100) NOT NULL,
    ordem INT NOT NULL DEFAULT 0,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela para armazenar as permissões de acesso aos menus por usuário
CREATE TABLE permissoes_usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    menu_id INT NOT NULL,
    visualizar TINYINT(1) NOT NULL DEFAULT 0,
    criar TINYINT(1) NOT NULL DEFAULT 0,
    editar TINYINT(1) NOT NULL DEFAULT 0,
    excluir TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
    UNIQUE KEY unique_usuario_menu (usuario_id, menu_id)
);

CREATE TABLE IF NOT EXISTS filiais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nome_fantasia VARCHAR(100) NOT NULL,
    razao_social VARCHAR(150) NOT NULL,
    cnpj VARCHAR(14) NOT NULL UNIQUE,
    ie VARCHAR(20),
    telefone VARCHAR(20),
    email VARCHAR(100),
    cep VARCHAR(8),
    logradouro VARCHAR(150),
    numero VARCHAR(10),
    complemento VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendedores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rca VARCHAR(20) NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    senha VARCHAR(255) NOT NULL,
    filial_id INT,
    ativo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (filial_id) REFERENCES filiais(id) ON DELETE SET NULL
);

CREATE TABLE produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codprod INT(10) NOT NULL,
    codauxiliar VARCHAR(20) NOT NULL,
    descricao VARCHAR(200) NOT NULL,
    pvenda FLOAT(10, 2) NOT NULL,
    descontofidelidade FLOAT(10, 2) NOT NULL DEFAULT 0,
    pvendafidelidade FLOAT(10, 2) NOT NULL DEFAULT 0,
    dtfinalfidelidade DATE,
    oferta_filial_2 FLOAT(10, 2) NOT NULL DEFAULT 0,
    oferta_filial_3 FLOAT(10, 2) NOT NULL DEFAULT 0,
    oferta_filial_4 FLOAT(10, 2) NOT NULL DEFAULT 0,
    oferta_filial_5 FLOAT(10, 2) NOT NULL DEFAULT 0,
    oferta_filial_6 FLOAT(10, 2) NOT NULL DEFAULT 0,
    oferta_filial_7 FLOAT(10, 2) NOT NULL DEFAULT 0,
    oferta_filiais_offers INT(10) NOT NULL DEFAULT 0
);

CREATE TABLE aparelhos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codaparelho VARCHAR(200) NOT NULL UNIQUE,
    autorized BOOLEAN,
    vendedor_id INT,
    FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE SET NULL
);

CREATE TABLE sincronizacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codaparelho VARCHAR(200) NOT NULL,
  quantidade_produtos INT NOT NULL,
  data_sincronizacao DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (codaparelho) REFERENCES aparelhos(codaparelho)
);

CREATE TABLE pcativi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codativi VARCHAR(200) NOT NULL,
    ramo VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
); 

CREATE TABLE pccidade (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codcidade VARCHAR(200) NOT NULL,
    nomecidade VARCHAR(255) NOT NULL,
    uf VARCHAR(2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
); 

CREATE TABLE IF NOT EXISTS sistema_manutencao (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 = sistema operacional, 1 = sistema em manutenção',
    tipo_manutencao ENUM('geral', 'correcao_bugs', 'atualizacao', 'melhoria_performance', 'backup', 'outro') DEFAULT 'geral',
    mensagem LONGTEXT COMMENT 'Mensagem a ser exibida durante a manutenção',
    data_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_fim TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sistema_atualizacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    versao VARCHAR(20) NOT NULL COMMENT 'Versão da atualização (ex: 1.0.1)',
    titulo VARCHAR(100) NOT NULL,
    descricao TEXT NOT NULL COMMENT 'Descrição das novidades da atualização',
    link_download VARCHAR(255) NOT NULL COMMENT 'URL para download da nova versão',
    obrigatoria TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 = opcional, 1 = obrigatória',
    ativa TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0 = inativa, 1 = ativa',
    data_lancamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela para armazenar os informativos
CREATE TABLE IF NOT EXISTS informativos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(100) NOT NULL,
    texto TEXT NOT NULL,
    data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ativo TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0 = inativo, 1 = ativo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela para armazenar as imagens dos informativos
CREATE TABLE IF NOT EXISTS informativos_imagens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    informativo_id INT NOT NULL,
    imagem MEDIUMBLOB NOT NULL,
    tipo_imagem VARCHAR(50) NOT NULL,
    descricao VARCHAR(255),
    ordem INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (informativo_id) REFERENCES informativos(id) ON DELETE CASCADE
);

-- Tabela para armazenar os dados de vendas por dia
CREATE TABLE IF NOT EXISTS vendas_diarias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data DATE NOT NULL,
    codusur VARCHAR(20) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    media_itens DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ticket_medio DECIMAL(10, 2) NOT NULL DEFAULT 0,
    vlcustofin DECIMAL(10, 2) NOT NULL DEFAULT 0,
    qtcliente INT NOT NULL DEFAULT 0,
    qtd_pedidos INT NOT NULL DEFAULT 0,
    via DECIMAL(10, 2) NOT NULL DEFAULT 0,
    vlvendadodia DECIMAL(10, 2) NOT NULL DEFAULT 0,
    vldevolucao DECIMAL(10, 2) NOT NULL DEFAULT 0,
    valor_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_codusur_data (codusur, data),
    INDEX idx_data (data)
);

-- Tabela para armazenar os totais de vendas por período
CREATE TABLE IF NOT EXISTS vendas_totais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codusur VARCHAR(20) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    total_qtd_pedidos INT NOT NULL DEFAULT 0,
    total_media_itens DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_ticket_medio DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_vlcustofin DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_qtcliente INT NOT NULL DEFAULT 0,
    total_via DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_vlvendadodia DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_vldevolucao DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_valor DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_codusur_periodo (codusur, data_inicio, data_fim),
    INDEX idx_periodo (data_inicio, data_fim)
);

CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codcli VARCHAR(255) NULL,
    corporate BOOLEAN NOT NULL DEFAULT 0, -- Indica se é uma pessoa jurídica (true) ou pessoa física (false)
    name VARCHAR(255) NOT NULL, -- Nome completo do cliente
    trade_name VARCHAR(255), -- Nome fantasia
    person_identification_number VARCHAR(20) NOT NULL UNIQUE, -- CPF ou CNPJ
    state_inscription VARCHAR(50) DEFAULT 'ISENTO', -- Inscrição estadual, se houver
    commercial_address VARCHAR(255) DEFAULT 'ENDERECO COMERCIAL NÃO INFORMADO', -- Endereço comercial
    commercial_address_number VARCHAR(10) DEFAULT 'S/N', -- Número do endereço
    business_district VARCHAR(100) DEFAULT 'BAIRRO NÃO INFORMADO', -- Bairro
    commercial_zip_code VARCHAR(20) DEFAULT '68513702', -- CEP
    billingPhone VARCHAR(20), -- Telefone
    email VARCHAR(255) NOT NULL, -- Email principal
    email_nfe VARCHAR(255), -- Email para NFe
    customer_origin VARCHAR(50) DEFAULT 'VT', -- Origem do cliente (exemplo: VT)
    final_customer BOOLEAN NOT NULL DEFAULT 0, -- Se é consumidor final (0 ou 1)
    billing_id CHAR(1), -- Identificação de faturamento
    square_id INT, -- ID do setor ou área de atuação Núcleo da Cidade
    activity_id INT, -- ID da atividade ou setor
    business_city VARCHAR(100), -- Cidade comercial
    seller_id INT DEFAULT 1, -- ID do vendedor responsável
    city_id INT DEFAULT 11345, -- ID da cidade (relacionado ao sistema interno)
    country_id INT DEFAULT 1058, -- ID do país
    document_type CHAR(1) DEFAULT 'A', -- Tipo de documento
    registered BOOLEAN NOT NULL DEFAULT 0, -- Informa se o cadastro já foi registrado.
    authorized BOOLEAN NOT NULL DEFAULT 0,
    recused BOOLEAN NOT NULL DEFAULT 0,
    recused_msg VARCHAR(225) NULL,
    filial INT,
    rca INT,
    novo INT,
    atualizado INT,
    data_nascimento DATE,
    consolid INT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Data de criação do registro
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP -- Data de atualização do registro
);

CREATE TABLE config_cadastro_clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timer INT NOT NULL,
    automatic BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO config_cadastro_clientes (timer, automatic) VALUES (3000, 0);

CREATE TABLE departamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rid VARCHAR(50) NOT NULL,
    atualizainvgeral CHAR(1) NOT NULL DEFAULT 'N',
    codpto INT NOT NULL UNIQUE,
    descricao VARCHAR(100) NOT NULL,
    margemprevista DECIMAL(10,2) DEFAULT 0,
    referencia VARCHAR(10),
    tipomerc VARCHAR(2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


CREATE TABLE secao (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rid VARCHAR(50) NOT NULL,
    codpto INT NOT NULL,
    codsec INT NOT NULL,
    descricao VARCHAR(100) NOT NULL,
    linha VARCHAR(1),
    qtmax INT,
    tipo VARCHAR(1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (codpto) REFERENCES departamentos(codpto)
);


-- Tabela para armazenar as configurações de filtros de departamentos por vendedor
CREATE TABLE IF NOT EXISTS vendedor_departamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendedor_id INT NOT NULL,
    departamento_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE CASCADE,
    FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE CASCADE,
    UNIQUE KEY unique_vendedor_departamento (vendedor_id, departamento_id)
);

-- Tabela para armazenar as configurações de filtros de seções por vendedor
CREATE TABLE IF NOT EXISTS vendedor_secoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendedor_id INT NOT NULL,
    secao_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE CASCADE,
    FOREIGN KEY (secao_id) REFERENCES secao(id) ON DELETE CASCADE,
    UNIQUE KEY unique_vendedor_secao (vendedor_id, secao_id)
);

-- Tabela para armazenar as metas de vendas dos vendedores
CREATE TABLE IF NOT EXISTS metas_vendas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendedor_id INT NOT NULL,
    mes INT NOT NULL COMMENT 'Mês da meta (1-12)',
    ano INT NOT NULL COMMENT 'Ano da meta',
    valor_meta DECIMAL(15, 2) NOT NULL DEFAULT 0 COMMENT 'Valor da meta de vendas em R$',
    valor_realizado DECIMAL(15, 2) DEFAULT 0 COMMENT 'Valor realizado até o momento',
    percentual_atingido DECIMAL(5, 2) DEFAULT 0 COMMENT 'Percentual atingido da meta',
    status ENUM('pendente', 'em_andamento', 'concluida', 'nao_atingida') DEFAULT 'pendente',
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE CASCADE
);

-- Tabela para armazenar as metas de cadastro de clientes dos vendedores
CREATE TABLE IF NOT EXISTS metas_cadastro_clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendedor_id INT NOT NULL,
    mes INT NOT NULL COMMENT 'Mês da meta (1-12)',
    ano INT NOT NULL COMMENT 'Ano da meta',
    quantidade_meta INT NOT NULL DEFAULT 0 COMMENT 'Quantidade de novos clientes a cadastrar',
    quantidade_realizada INT DEFAULT 0 COMMENT 'Quantidade de clientes cadastrados até o momento',
    percentual_atingido DECIMAL(5, 2) DEFAULT 0 COMMENT 'Percentual atingido da meta',
    status ENUM('pendente', 'em_andamento', 'concluida', 'nao_atingida') DEFAULT 'pendente',
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE CASCADE
);

-- Tabela para histórico de atualizações das metas
CREATE TABLE IF NOT EXISTS historico_atualizacao_metas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meta_id INT NOT NULL COMMENT 'ID da meta relacionada',
    tipo_meta VARCHAR(50) NOT NULL COMMENT 'Tipo de meta (vendas ou cadastro_clientes)',
    vendedor_id INT NOT NULL COMMENT 'ID do vendedor relacionado à meta',
    mes INT NOT NULL COMMENT 'Mês da meta',
    ano INT NOT NULL COMMENT 'Ano da meta',
    valor_anterior DECIMAL(10,2) NULL DEFAULT NULL COMMENT 'Valor anterior (para metas de vendas)',
    valor_novo DECIMAL(10,2) NULL DEFAULT NULL COMMENT 'Novo valor (para metas de vendas)',
    quantidade_anterior INT NULL DEFAULT NULL COMMENT 'Quantidade anterior (para metas de cadastro)',
    quantidade_nova INT NULL DEFAULT NULL COMMENT 'Nova quantidade (para metas de cadastro)',
    observacoes TEXT NULL DEFAULT NULL COMMENT 'Observações sobre a meta',
    data_atualizacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Data e hora da atualização',
    usuario VARCHAR(100) NOT NULL COMMENT 'Nome do usuário que fez a alteração',
    INDEX fk_historico_vendedor_idx (vendedor_id ASC),
    FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE CASCADE
);

-- Tabela para controlar o acesso às funcionalidades do aplicativo por aparelho
CREATE TABLE controle_acesso_funcao_app (
    id INT AUTO_INCREMENT PRIMARY KEY,
    aparelho_id INT NOT NULL,
    orcamentos BOOLEAN NOT NULL DEFAULT 1,
    minhas_vendas BOOLEAN NOT NULL DEFAULT 1,
    minhas_metas BOOLEAN NOT NULL DEFAULT 1,
    informativos BOOLEAN NOT NULL DEFAULT 1,
    buscar_produto BOOLEAN NOT NULL DEFAULT 1,
    ofertas BOOLEAN NOT NULL DEFAULT 1,
    clientes BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (aparelho_id) REFERENCES aparelhos(id) ON DELETE CASCADE
);

-- Ao cadastrar um aparelho, todas as funcionalidades são habilitadas por padrão
DELIMITER //
CREATE TRIGGER after_aparelho_insert
AFTER INSERT ON aparelhos
FOR EACH ROW
BEGIN
    INSERT INTO controle_acesso_funcao_app (aparelho_id, orcamentos, minhas_vendas, minhas_metas, informativos, buscar_produto, ofertas, clientes)
    VALUES (NEW.id, 1, 0, 0, 1, 1, 1, 1);
END //
DELIMITER ;

-- Inserir permissões para o usuário admin (acesso total a todos os menus)
INSERT INTO permissoes_usuarios (usuario_id, menu_id, visualizar, criar, editar, excluir)
SELECT 1, id, 1, 1, 1, 1 FROM menus;

-- Inserir permissões apenas para menus que ainda não estão associados ao usuário admin
INSERT INTO permissoes_usuarios (usuario_id, menu_id, visualizar, criar, editar, excluir)
SELECT 1, m.id, 1, 1, 1, 1
FROM menus m
WHERE NOT EXISTS (
    SELECT 1
    FROM permissoes_usuarios p
    WHERE p.usuario_id = 1 AND p.menu_id = m.id
);

INSERT INTO
  `usuarios` (
    `id`,
    `nome`,
    `email`,
    `senha`,
    `cpf`,
    `telefone`,
    `tipo_usuario`,
    `ativo`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    1,
    'ADMIN',
    'admin@gmail.com',
    '$2y$10$EhvQdSAYHUrfUdGVllKIju9QuIcflj/AzAC61mbjIStf9F/ekEDgK',
    '12345678910',
    '94981111111',
    'admin',
    1,
    '2024-11-06 12:48:53',
    '2024-11-06 14:27:47'
  );



-- Inserir os menus do sistema
INSERT INTO menus (nome, descricao, icone, rota, ordem, ativo) VALUES
('Aparelhos', 'Gestão de aparelhos', 'smartphone', '/aparelhos', 1, 1),
('Ramos de Atividades', 'Gestão de ramos de atividades', 'business', '/ramos-atividades', 2, 1),
('Clientes', 'Gestão de clientes', 'people', '/clientes', 3, 1),
('Vendedores', 'Gestão de vendedores', 'badge', '/vendedores', 4, 1),
('Filiais', 'Gestão de filiais', 'store', '/filiais', 5, 1),
('Departamentos', 'Gestão de departamentos', 'category', '/departamentos', 6, 1),
('Seções', 'Gestão de seções', 'view_module', '/secoes', 7, 1),
('Vendas', 'Relatórios de vendas', 'point_of_sale', '/vendas', 8, 1),
('Monitoramento de Vendas', 'Monitoramento de pedidos e sincronização', 'display', '/monitoramento-vendas', 9, 1),
('Informativos', 'Gestão de informativos', 'campaign', '/informativos', 10, 1),
('Config. Cadastro Clientes', 'Configurações de cadastro de clientes', 'settings_applications', '/config-cadastro-clientes', 11, 1),
('Manutenção', 'Configurações de manutenção do sistema', 'build', '/manutencao', 12, 1),
('Atualizações', 'Gestão de atualizações do sistema', 'system_update', '/atualizacoes', 13, 1),
('Minha Conta', 'Configurações da conta do usuário', 'account_circle', '/minha-conta', 14, 1),
('Usuários', 'Gestão de usuários do sistema', 'admin_panel_settings', '/usuarios', 15, 1),
('NPS Dashboard', 'Dashboard com métricas e estatísticas do NPS', 'fas fa-chart-line', '/nps/dashboard', 100, 1),
('NPS Campanhas', 'Criar e gerenciar campanhas de pesquisa NPS', 'fas fa-bullhorn', '/nps/campanhas', 102, 1),
('WhatsApp Instâncias', 'Controle local de instâncias WhatsApp com whatsapp-web.js', 'fas fa-comments', '/whatsapp/instances', 105, 1);
 
 
INSERT INTO `filiais` (`id`, `codigo`, `nome_fantasia`, `razao_social`, `cnpj`, `ie`, `telefone`, `email`, `cep`, `logradouro`, `numero`, `complemento`, `created_at`, `updated_at`) VALUES
(1, '1', 'NOVO TOK- MATRIZ CD', 'EAN COMERCIO DE COSMETICOS LTDA', '03480552000132', '152080929', '94991030422', 'NOVOTOKFINANCEIRO@GMAIL.COM', '68513702', 'AV UM LOTEAMENTO NOVO PROG', '04', '', '2025-07-08 13:31:20', '2025-07-08 13:35:41'),
(2, '2', 'NOVO TOK SÃO FELIX', 'EAN CORMECIO DE COSMETICOS LTDA', '03480552000213', '157880214', '94991789550', 'NOVOTOKCOMPRAS@HOTAMIL.COM', '68514300', 'BR 222 KM 02', '08', '', '2025-07-08 13:32:08', '2025-07-08 13:35:35'),
(3, '3', 'NOVO TOK CN', 'EAN COMERCIO DE COSMETICOS LTDA', '03480552000302', '157880265', '949991031719', 'NOVOTOKCOMPRAS@HOTMAIL.COM', '68501570', 'AV NAGIB MUTRAN ', '375', '', '2025-07-08 13:33:23', '2025-07-08 13:35:31'),
(4, '4', 'NOVO TOK TOP', 'EAN COMERCIO DE COSMETICOS', '03480552000485', '157880206', '94991095851', 'NOVOTOKCOMPRAS@HOTMAIL.COM', '68500440', 'AV ANTONIO MAIA ', '406', '', '2025-07-08 13:34:55', '2025-07-08 13:35:15'),
(5, '5', 'NOVO TOK ITUPIRANGA', 'EAN COMERCIO DE COSMETICOS LTDA', '03480552000566', '157880257', '94981198291', 'NOVOTOKCOMPRAS@HOTMAIL.COM', '68580000', 'CENTRO', '1346', '', '2025-07-08 13:39:38', '2025-07-08 13:39:38'),
(6, '6', 'NOVO TOK SHOP', 'EAN COMERCIO DE COSMETICOS LTDA', '03480552000647', '157880192', '94991118423', 'NOVOTOKCOMPRAS@HOTMAIL.COM', '68507445', 'QD 15 FL 30', '10', '', '2025-07-08 13:40:30', '2025-07-08 13:40:30'),
(7, '7', 'NOVOTOK  FL28', 'EAN COMERCIO DE COSMETICOS LTDA', '03480552000728', '158079310', '94991030422', 'NOVOTOKFINANCEIRO@GMAIL.COM', '68506100', 'Q DEZ', 'S/N', '', '2025-07-08 13:41:29', '2025-07-08 13:53:14'),
(8, '8', 'NOVO TOK PARAUPEBAS', 'EAN CORMECIO DE COSMETICOS LTDA', '03480552000809', '750165294', '94999212243', 'NOVOTOKFINANCEIRO@GMAIL.COM', '68515000', 'QUADRA46 LOTE 31 E 32 COM 02', '31', '', '2025-07-08 13:42:39', '2025-07-08 13:42:39');
COMMIT;


INSERT INTO `pcativi` (`id`, `codativi`, `ramo`, `created_at`, `updated_at`) VALUES
(2, '6', 'CABELEIREIRO', '2024-12-13 01:38:31', '2024-12-13 01:38:31'),
(3, '11', 'MANICURE', '2024-12-13 01:38:43', '2024-12-13 01:38:43'),
(6, '9', 'ESTETICA/FISIOTERAPEUTA', '2024-12-13 04:08:29', '2024-12-13 04:08:29'),
(7, '7', 'CONSUMIDOR FINAL', '2024-12-13 11:27:12', '2024-12-13 11:27:12'),
(8, '12', 'MAQUIADOR', '2024-12-13 11:29:39', '2024-12-13 11:29:39'),
(9, '10', 'BARBEARIA', '2024-12-13 11:32:51', '2024-12-13 11:32:51'),
(10, '18', 'TATUADOR', '2024-12-13 13:04:24', '2024-12-13 13:04:24'),
(11, '19', 'DESIGN', '2024-12-13 13:04:46', '2025-07-16 18:53:11'),
(12, '20', 'INSTITUTOS', '2024-12-13 13:05:11', '2024-12-13 13:05:11'),
(13, '4', 'FORNECEDORES', '2024-12-13 13:06:47', '2024-12-13 13:06:47');
COMMIT;


-- Inserir registro inicial para sistema_manutencao
INSERT INTO sistema_manutencao (status, tipo_manutencao, mensagem) VALUES (0, 'geral', 'Sistema operacional');


-- Inserir permissões para o usuário admin (acesso total a todos os menus)
INSERT INTO permissoes_usuarios (usuario_id, menu_id, visualizar, criar, editar, excluir)
SELECT 1, id, 1, 1, 1, 1 FROM menus;


-- A partir daqui tabelas para PDV
-- Tabela para armazenar os pedidos
CREATE TABLE pedidos (
    pedido INT PRIMARY KEY,
    filial INT NOT NULL,
    caixa INT NOT NULL,
    data DATETIME NOT NULL,
    funccx INT,
    itens LONGTEXT NOT NULL,
    cancelados LONGTEXT NOT NULL,
    codcob VARCHAR(20),
    total_itens DECIMAL(10, 2),
    total_cancelados DECIMAL(10, 2),
    data_registro_produto DATETIME,
    vendedor INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela para armazenar as requisições para sincronização de PDV
CREATE TABLE request (
   id INT AUTO_INCREMENT PRIMARY KEY,
   filial INT NOT NULL,
   caixa INT NOT NULL,
   datavendas DATE NOT NULL,
   nregistros INT,
   completed BOOLEAN DEFAULT FALSE, -- Indica se a requisição foi concluída
   processando BOOLEAN DEFAULT FALSE, -- Indica se a requisição está em processamento
   error BOOLEAN DEFAULT FALSE, -- Indica se ocorreu algum erro
   initial BOOLEAN DEFAULT FALSE,
   message TEXT, -- Armazena a mensagem de erro ou informações adicionais
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Data e hora de criação do registro
);



-- =====================================================
-- TABELAS BÁSICAS PARA SISTEMA NPS
-- =====================================================

-- TABELA DE INSTÂNCIAS WHATSAPP
CREATE TABLE IF NOT EXISTS instancias_whatsapp (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(100) NOT NULL,
    identificador VARCHAR(50) UNIQUE NOT NULL,
    url_webhook VARCHAR(255),
    token_api VARCHAR(200),
    numero_whatsapp VARCHAR(20),
    status ENUM('ativa', 'inativa', 'manutencao') DEFAULT 'ativa',
    status_conexao ENUM('desconectado', 'conectando', 'conectado', 'erro', 'qr_code') DEFAULT 'desconectado',
    qrcode TEXT,
    session_path VARCHAR(255),
    max_envios_por_minuto INT DEFAULT 10,
    timeout_conversa_minutos INT DEFAULT 30,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ultima_conexao TIMESTAMP NULL,
    
    INDEX idx_identificador (identificador),
    INDEX idx_status (status),
    INDEX idx_status_conexao (status_conexao),
    INDEX idx_numero_whatsapp (numero_whatsapp)
);

-- TABELA DE CAMPANHAS NPS
CREATE TABLE IF NOT EXISTS campanhas_nps (
    id INT PRIMARY KEY AUTO_INCREMENT,
    instancia_id INT NULL, -- Permite campanhas sem instância vinculada
    nome VARCHAR(150) NOT NULL,
    descricao TEXT,
    pergunta_principal TEXT NOT NULL,
    mensagem_inicial TEXT,
    mensagem_final TEXT,
    dias_apos_compra INT DEFAULT 7,
    disparo_imediato BOOLEAN DEFAULT FALSE,
    status ENUM('ativa', 'inativa', 'pausada') DEFAULT 'ativa',
    data_inicio DATE,
    data_fim DATE,
    max_tentativas_envio INT DEFAULT 3,
    intervalo_reenvio_dias INT DEFAULT 7,
    horario_envio_inicio TIME DEFAULT '09:00:00',
    horario_envio_fim TIME DEFAULT '18:00:00',
    dias_semana_envio VARCHAR(20) DEFAULT '1,2,3,4,5,6',
    filiais_ativas JSON,
    timeout_conversa_minutos INT DEFAULT 30,
    imagem LONGBLOB NULL COMMENT 'Imagem da campanha em formato base64 ou binário',
    imagem_tipo VARCHAR(50) NULL COMMENT 'Tipo MIME da imagem (image/jpeg, image/png, etc)',
    imagem_nome VARCHAR(255) NULL COMMENT 'Nome original do arquivo da imagem',
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (instancia_id) REFERENCES instancias_whatsapp(id) ON DELETE SET NULL,
    INDEX idx_instancia (instancia_id),
    INDEX idx_status (status),
    INDEX idx_disparo_imediato (disparo_imediato)
);

-- TABELA DE PERGUNTAS DA PESQUISA
CREATE TABLE IF NOT EXISTS perguntas_nps (
    id INT PRIMARY KEY AUTO_INCREMENT,
    campanha_id INT NOT NULL,
    pergunta TEXT NOT NULL,
    tipo_resposta ENUM('nota_nps', 'texto_livre', 'multipla_escolha', 'sim_nao', 'numero') DEFAULT 'texto_livre',
    opcoes_resposta JSON,
    validacao_regex VARCHAR(255),
    mensagem_erro VARCHAR(255) DEFAULT 'Resposta inválida. Tente novamente.',
    obrigatoria BOOLEAN DEFAULT FALSE,
    ordem INT DEFAULT 1,
    status ENUM('ativa', 'inativa') DEFAULT 'ativa',
    
    FOREIGN KEY (campanha_id) REFERENCES campanhas_nps(id) ON DELETE CASCADE,
    INDEX idx_campanha_ordem (campanha_id, ordem),
    INDEX idx_status (status)
);

-- TABELA DE CONTROLE DE ENVIOS
CREATE TABLE IF NOT EXISTS controle_envios_nps (
    id INT PRIMARY KEY AUTO_INCREMENT,
    instancia_id INT NULL COMMENT 'NULL quando instância foi deletada (preserva histórico)',
    pedido_id INT NOT NULL,
    numero_pedido VARCHAR(50) NOT NULL,
    filial INT NOT NULL,
    caixa INT NOT NULL,
    codcli INT NOT NULL,
    celular VARCHAR(20) NOT NULL,
    nome_cliente VARCHAR(150),
    email_cliente VARCHAR(150),
    campanha_id INT NOT NULL,
    token_pesquisa VARCHAR(100) UNIQUE,
    status_envio ENUM('pendente', 'enviado', 'em_andamento', 'finalizado', 'cancelado', 'erro', 'numero_invalido') DEFAULT 'pendente',
    tentativas_envio INT DEFAULT 0,
    ultimo_erro TEXT,
    data_elegivel DATETIME,
    data_envio DATETIME,
    data_inicio_conversa DATETIME,
    data_fim_conversa DATETIME,
    motivo_cancelamento TEXT,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (instancia_id) REFERENCES instancias_whatsapp(id) ON DELETE SET NULL,
    FOREIGN KEY (campanha_id) REFERENCES campanhas_nps(id),
    UNIQUE KEY unique_pedido_campanha (pedido_id, campanha_id),
    CHECK (codcli != 1),
    INDEX idx_instancia (instancia_id),
    INDEX idx_pedido (pedido_id),
    INDEX idx_codcli (codcli),
    INDEX idx_celular (celular),
    INDEX idx_token (token_pesquisa),
    INDEX idx_status_envio (status_envio),
    INDEX idx_data_elegivel (data_elegivel)
);

-- TABELA DE ESTADO DA CONVERSA
CREATE TABLE IF NOT EXISTS estado_conversa_nps (
    id INT PRIMARY KEY AUTO_INCREMENT,
    controle_envio_id INT NOT NULL,
    instancia_id INT NULL COMMENT 'NULL quando instância foi deletada (preserva histórico)',
    celular VARCHAR(20) NOT NULL,
    pergunta_atual_id INT DEFAULT 0,
    ordem_resposta INT DEFAULT 0,
    aguardando_resposta BOOLEAN DEFAULT TRUE,
    proxima_acao ENUM('pergunta_principal', 'pergunta_adicional', 'finalizar') DEFAULT 'pergunta_principal',
    data_timeout DATETIME,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (controle_envio_id) REFERENCES controle_envios_nps(id) ON DELETE CASCADE,
    FOREIGN KEY (instancia_id) REFERENCES instancias_whatsapp(id) ON DELETE SET NULL,
    FOREIGN KEY (pergunta_atual_id) REFERENCES perguntas_nps(id),
    UNIQUE KEY unique_conversa (controle_envio_id),
    INDEX idx_celular_instancia (celular, instancia_id),
    INDEX idx_aguardando_resposta (aguardando_resposta),
    INDEX idx_data_timeout (data_timeout)
);

-- TABELA DE RESPOSTAS COLETADAS
CREATE TABLE IF NOT EXISTS respostas_nps (
    id INT PRIMARY KEY AUTO_INCREMENT,
    controle_envio_id INT NOT NULL,
    instancia_id INT NULL COMMENT 'NULL quando instância foi deletada (preserva histórico)',
    pedido_id INT NOT NULL,
    codcli INT NOT NULL,
    campanha_id INT NOT NULL,
    pergunta_id INT NULL, -- NULL para pergunta principal (nota NPS)
    resposta_texto TEXT,
    nota_nps INT NULL CHECK (nota_nps >= 0 AND nota_nps <= 10),
    classificacao_nps ENUM('detrator', 'neutro', 'promotor') NULL,
    ordem_resposta INT DEFAULT 1,
    tempo_resposta_segundos INT,
    ip_origem VARCHAR(45),
    user_agent TEXT,
    data_resposta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (controle_envio_id) REFERENCES controle_envios_nps(id),
    FOREIGN KEY (instancia_id) REFERENCES instancias_whatsapp(id) ON DELETE SET NULL,
    FOREIGN KEY (pergunta_id) REFERENCES perguntas_nps(id),
    INDEX idx_controle_envio (controle_envio_id),
    INDEX idx_pergunta (pergunta_id),
    INDEX idx_nota_nps (nota_nps),
    INDEX idx_classificacao (classificacao_nps),
    INDEX idx_data_resposta (data_resposta),
    INDEX idx_ordem_resposta (controle_envio_id, ordem_resposta)
);

-- TABELA DE LOG DE MENSAGENS WHATSAPP
CREATE TABLE IF NOT EXISTS log_mensagens_whatsapp (
    id INT PRIMARY KEY AUTO_INCREMENT,
    instancia_id INT NULL COMMENT 'NULL quando instância foi deletada (preserva histórico)',
    celular VARCHAR(20) NOT NULL,
    numero_whatsapp VARCHAR(20),
    message_id VARCHAR(100),
    tipo_mensagem ENUM('pergunta_nps', 'resposta_cliente', 'comando', 'erro', 'timeout', 'cancelamento', 'finalizacao') NOT NULL,
    conteudo TEXT,
    direcao ENUM('enviada', 'recebida') NOT NULL,
    status_entrega ENUM('pendente', 'enviada', 'entregue', 'lida', 'erro') DEFAULT 'pendente',
    erro_detalhes TEXT,
    data_mensagem TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (instancia_id) REFERENCES instancias_whatsapp(id) ON DELETE SET NULL,
    INDEX idx_instancia (instancia_id),
    INDEX idx_celular (celular),
    INDEX idx_numero_whatsapp (numero_whatsapp),
    INDEX idx_data_mensagem (data_mensagem)
);

-- ========================================
-- TABELAS PARA SISTEMA DE METAS DE LOJAS
-- ========================================

-- Tabela para armazenar grupos de metas de produtos reutilizáveis
CREATE TABLE IF NOT EXISTS grupos_metas_produtos (
    id VARCHAR(50) PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    data_criacao DATE NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ativo (ativo),
    INDEX idx_data_criacao (data_criacao)
);

-- Tabela para armazenar as metas de produtos dentro dos grupos
CREATE TABLE IF NOT EXISTS metas_produtos_grupo (
    id VARCHAR(50) PRIMARY KEY,
    grupo_id VARCHAR(50) NOT NULL,
    nome_produto_marca VARCHAR(200) NOT NULL,
    qtd_meta INT NOT NULL DEFAULT 0,
    percentual_sobre_venda DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (grupo_id) REFERENCES grupos_metas_produtos(id) ON DELETE CASCADE,
    INDEX idx_grupo_id (grupo_id)
);

-- Tabela para armazenar grupos de metas reutilizáveis
CREATE TABLE IF NOT EXISTS grupos_metas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ativo (ativo)
);

-- Tabela principal para armazenar metas de lojas/filiais
CREATE TABLE IF NOT EXISTS metas_lojas (
    id VARCHAR(50) PRIMARY KEY,
    loja_id VARCHAR(50) NOT NULL,
    nome_loja VARCHAR(100) NOT NULL,
    mes INT NOT NULL COMMENT 'Mês da meta (1-12)',
    ano INT NOT NULL COMMENT 'Ano da meta',
    grupo_meta_id VARCHAR(50) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT 1,
    data_criacao DATE NOT NULL,
    valor_venda_loja_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_loja_id (loja_id),
    INDEX idx_mes_ano (mes, ano),
    INDEX idx_grupo_meta_id (grupo_meta_id),
    INDEX idx_ativo (ativo),
    UNIQUE KEY unique_loja_mes_ano (loja_id, mes, ano)
);

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

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_meta_loja_operadoras_meta_id ON meta_loja_operadoras_caixa(meta_loja_id);
CREATE INDEX IF NOT EXISTS idx_meta_loja_vendedoras_meta_id ON meta_loja_vendedoras(meta_loja_id);
CREATE INDEX IF NOT EXISTS idx_meta_loja_vendedoras_bijou_meta_id ON meta_loja_vendedoras_bijou(meta_loja_id);
CREATE INDEX IF NOT EXISTS idx_meta_loja_campanhas_meta_id ON meta_loja_campanhas(meta_loja_id);
CREATE INDEX IF NOT EXISTS idx_meta_loja_produtos_meta_id ON meta_loja_produtos(meta_loja_id);
CREATE INDEX IF NOT EXISTS idx_meta_loja_produtos_funcionario ON meta_loja_produtos(funcionario_id, tipo_funcionario);
CREATE INDEX IF NOT EXISTS idx_meta_loja_funcionarios_meta_id ON meta_loja_funcionarios(meta_loja_id);

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
    esmaltes DECIMAL(15,2) NOT NULL DEFAULT 0,
    profissional_parceiras DECIMAL(15,2) NOT NULL DEFAULT 0,
    percentual_profissional DECIMAL(5,2) NOT NULL DEFAULT 2.00,
    valor_vendido_make DECIMAL(15,2) NOT NULL DEFAULT 0,
    quantidade_malka INT NOT NULL DEFAULT 0,
    valor_malka DECIMAL(15,2) NOT NULL DEFAULT 0,
    bijou_make_bolsas DECIMAL(15,2) NOT NULL DEFAULT 0,
    -- Comissões
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
