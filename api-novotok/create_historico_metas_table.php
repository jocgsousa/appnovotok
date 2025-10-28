<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once 'database.php';
include_once 'cors_config.php';
include_once 'jwt_utils.php';

// Verificar se o método de requisição é OPTIONS e responder adequadamente
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("HTTP/1.1 200 OK");
    exit;
}

// Verificar o token JWT
$token = get_bearer_token();
if (!$token || !is_jwt_valid($token)) {
    http_response_code(401);
    echo json_encode(array("status" => 0, "message" => "Não autorizado"));
    exit;
}

// Método GET
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Instanciar banco de dados
        $database = new Database();
        $db = $database->getConnection();

        // Verificar se a tabela existe
        $query_check = "SELECT COUNT(*) FROM information_schema.tables 
                       WHERE table_schema = DATABASE() 
                       AND table_name = 'historico_atualizacao_metas'";
        $stmt_check = $db->prepare($query_check);
        $stmt_check->execute();
        $table_exists = (bool)$stmt_check->fetchColumn();

        if (!$table_exists) {
            // Criar a tabela se não existir
            $query_create = "CREATE TABLE historico_atualizacao_metas (
                id INT(11) NOT NULL AUTO_INCREMENT,
                meta_id INT(11) NOT NULL,
                tipo_meta VARCHAR(50) NOT NULL,
                vendedor_id INT(11) NOT NULL,
                mes INT(11) NOT NULL,
                ano INT(11) NOT NULL,
                valor_anterior DECIMAL(10,2) NULL DEFAULT NULL,
                valor_novo DECIMAL(10,2) NULL DEFAULT NULL,
                quantidade_anterior INT(11) NULL DEFAULT NULL,
                quantidade_nova INT(11) NULL DEFAULT NULL,
                observacoes TEXT NULL DEFAULT NULL,
                data_atualizacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                usuario VARCHAR(100) NOT NULL,
                PRIMARY KEY (id),
                INDEX fk_historico_vendedor_idx (vendedor_id ASC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;";
            
            $stmt_create = $db->prepare($query_create);
            $stmt_create->execute();
            
            http_response_code(200);
            echo json_encode(array(
                "status" => 1,
                "message" => "Tabela de histórico de metas criada com sucesso"
            ));
        } else {
            // Verificar se a tabela tem todas as colunas necessárias
            $query_check_columns = "SHOW COLUMNS FROM historico_atualizacao_metas";
            $stmt_check_columns = $db->prepare($query_check_columns);
            $stmt_check_columns->execute();
            $columns = $stmt_check_columns->fetchAll(PDO::FETCH_COLUMN);
            
            // Verificar se as colunas mes e ano existem
            if (!in_array('mes', $columns) || !in_array('ano', $columns)) {
                // Adicionar as colunas faltantes
                $query_alter = "ALTER TABLE historico_atualizacao_metas 
                               ADD COLUMN IF NOT EXISTS mes INT(11) NOT NULL AFTER vendedor_id,
                               ADD COLUMN IF NOT EXISTS ano INT(11) NOT NULL AFTER mes";
                $stmt_alter = $db->prepare($query_alter);
                $stmt_alter->execute();
                
                http_response_code(200);
                echo json_encode(array(
                    "status" => 1,
                    "message" => "Tabela de histórico de metas atualizada com sucesso"
                ));
            } else {
                http_response_code(200);
                echo json_encode(array(
                    "status" => 1,
                    "message" => "Tabela de histórico de metas já existe e está atualizada"
                ));
            }
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array(
            "status" => 0,
            "message" => "Erro ao criar tabela de histórico de metas: " . $e->getMessage()
        ));
    }
} else {
    // Método não permitido
    http_response_code(405);
    echo json_encode(array(
        "status" => 0,
        "message" => "Método não permitido"
    ));
} 