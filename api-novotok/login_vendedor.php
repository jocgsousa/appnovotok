<?php

// Definindo os cabeçalhos CORS
require_once 'cors_config.php';
include_once 'database.php';
include_once 'jwt_utils.php';

// Decodificando o JSON recebido
$input_data = file_get_contents("php://input");
$data = json_decode($input_data);

// Verificando se o JSON foi decodificado corretamente
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "JSON inválido.", "error" => json_last_error_msg()]);
    exit;
}

// Verificando se o RCA e a senha foram fornecidos
if (!isset($data->rca) || !isset($data->password)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "RCA e senha são obrigatórios."]);
    exit;
}

try {
    // Conectando ao banco de dados
    $database = new Database();
    $db = $database->getConnection();

    // Consulta SQL para verificar o RCA
    $query = "SELECT id, rca, nome, senha, filial_id FROM vendedores WHERE rca = :rca LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':rca', $data->rca);

    $stmt->execute();

    // Verifica se o vendedor existe
    if ($stmt->rowCount() > 0) {
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        // Verifica se a senha está correta
        if (password_verify($data->password, $row['senha'])) {
            // Gera o token JWT
            $jwt = JwtUtils::createToken($row['id']);
            echo json_encode([
                "success" => true, 
                "message" => "Login bem-sucedido.", 
                "id" => $row['id'],
                "nome" => $row['nome'],
                "rca" => $row['rca'],
                "filial_id" => $row['filial_id'],
                "token" => $jwt
            ]);
        } else {
            http_response_code(401);
            echo json_encode(["success" => false, "message" => "Senha incorreta."]);
        }
    } else {
        http_response_code(401);
        echo json_encode(["success" => false, "message" => "RCA não encontrado."]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erro no servidor.", "error" => $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erro inesperado.", "error" => $e->getMessage()]);
} 