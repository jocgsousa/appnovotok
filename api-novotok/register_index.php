<?php
// Incluir configurações CORS globais primeiro
require_once 'cors_config.php';
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");

// Se for uma requisição OPTIONS, retornar imediatamente
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Definir cabeçalhos após o CORS
header("Content-Type: application/json");

require_once 'cors_config.php';
require 'database.php';
include_once 'jwt_utils.php';

// Inicializar conexão com o banco de dados
$database = new Database();
$db = $database->getConnection();

$headers = getallheaders();
if (!isset($headers['Authorization'])) {
    http_response_code(401);
    echo json_encode(["message" => "Token não fornecido."]);
    exit;
}

try {
    // Valida o token
    $jwt = str_replace('Bearer ', '', $headers['Authorization']);
    $user_id = JwtUtils::validateToken($jwt);

    if (!$user_id) {
        http_response_code(401);
        echo json_encode(["message" => "Token inválido."]);
        exit;
    }

    try {
        // Consulta os dados do usuário
        $stmt = $db->prepare("SELECT id, nome, email, cpf, telefone FROM usuarios WHERE id = :id");
        $stmt->execute(['id' => $user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            http_response_code(404);
            echo json_encode(["message" => "Usuário não encontrado."]);
            exit;
        }

        echo json_encode($user);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Erro ao consultar usuário: " . $e->getMessage()]);
    }
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(["message" => "Falha ao realizar requisição", "Erro:" => $e->getMessage()]);
}
?>