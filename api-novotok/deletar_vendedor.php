<?php

// Definindo os cabeçalhos CORS
require_once 'cors_config.php';
include_once 'database.php';
include_once 'jwt_utils.php';

// Verificar se o usuário está autenticado
$headers = getallheaders();
$token = null;

if (isset($headers['Authorization'])) {
    $authHeader = $headers['Authorization'];
    $token = str_replace('Bearer ', '', $authHeader);
}

if (!$token || !JwtUtils::validateToken($token)) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Não autorizado"]);
    exit;
}

// Decodificando o JSON recebido
$input_data = file_get_contents("php://input");
$data = json_decode($input_data);

// Verificando se o JSON foi decodificado corretamente
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "JSON inválido.", "error" => json_last_error_msg()]);
    exit;
}

// Verificando se o ID foi fornecido
if (!isset($data->id)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "ID do vendedor é obrigatório."]);
    exit;
}

try {
    // Conectando ao banco de dados
    $database = new Database();
    $db = $database->getConnection();

    // Verificar se o vendedor existe
    $query = "SELECT id FROM vendedores WHERE id = :id LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':id', $data->id);
    $stmt->execute();

    if ($stmt->rowCount() == 0) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Vendedor não encontrado."]);
        exit;
    }

    // Deletar o vendedor
    $query = "DELETE FROM vendedores WHERE id = :id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':id', $data->id);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true, 
            "message" => "Vendedor excluído com sucesso."
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erro ao excluir vendedor."]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erro no servidor.", "error" => $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erro inesperado.", "error" => $e->getMessage()]);
} 