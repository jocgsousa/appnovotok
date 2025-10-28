-- SCRIPT PARA ADICIONAR COLUNA MANUALMENTE
-- ALTER TABLE tabela
-- ADD COLUMN coluna INT DEFAULT 0;



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


CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE, -- Reduzido para 100 caracteres
    senha VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL UNIQUE, -- Reduzido para 11 caracteres
    telefone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timer INT NOT NULL,
    automatic BOOLEAN NOT NULL DEFAULT 0,
    manutencao BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE pcativi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codativi VARCHAR(200) NOT NULL,
    ramo VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
); 



INSERT INTO
  `usuarios` (
    `id`,
    `nome`,
    `email`,
    `senha`,
    `cpf`,
    `telefone`,
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
    '2024-11-06 12:48:53',
    '2024-11-06 14:27:47'
  );
  