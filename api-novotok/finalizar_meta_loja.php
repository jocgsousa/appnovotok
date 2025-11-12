<?php
require 'cors_config.php';
header("Content-Type: application/json; charset=UTF-8");

require 'database.php';
require 'jwt_utils.php';

// Verificar se o método da requisição é PATCH
if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') {
    http_response_code(405);
    echo json_encode([
        "status" => 0,
        "message" => "Método não permitido. Apenas PATCH é aceito."
    ]);
    exit;
}

// Obter o conteúdo do corpo da requisição
$data = json_decode(file_get_contents("php://input"));

// Verificar se o token JWT foi fornecido
$headers = getallheaders();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token de autenticação não fornecido ou inválido"
    ]);
    exit;
}

$jwt = $matches[1];

// Validar o token JWT
try {
    $payload = decodeJWT($jwt);
    $usuario_id = $payload->data->user_id;
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token inválido: " . $e->getMessage()
    ]);
    exit;
}

// Validar dados de entrada
if (!isset($data->id) || !trim($data->id)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "ID da meta é obrigatório."
    ]);
    exit;
}

$meta_id = trim($data->id);

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

try {
    // Verificar se a meta existe
    $sqlCheck = "SELECT id, ativo FROM metas_lojas WHERE id = ?";
    $stmtCheck = $conn->prepare($sqlCheck);
    $stmtCheck->bindValue(1, $meta_id);
    $stmtCheck->execute();

    if ($stmtCheck->rowCount() === 0) {
        http_response_code(404);
        echo json_encode([
            "status" => 0,
            "message" => "Meta de loja não encontrada."
        ]);
        exit;
    }

    $meta = $stmtCheck->fetch(PDO::FETCH_ASSOC);

    // Se já estiver inativa, retornar sucesso idempotente
    if ((int)$meta['ativo'] === 0) {
        http_response_code(200);
        echo json_encode([
            "status" => 1,
            "message" => "Meta já finalizada.",
            "data" => ["id" => $meta_id, "ativo" => false]
        ]);
        exit;
    }

    // Finalizar a meta (marcar como inativa)
    $sqlUpdate = "UPDATE metas_lojas SET ativo = 0 WHERE id = ?";
    $stmtUpdate = $conn->prepare($sqlUpdate);
    $stmtUpdate->bindValue(1, $meta_id);
    $stmtUpdate->execute();

    http_response_code(200);
    echo json_encode([
        "status" => 1,
        "message" => "Meta finalizada com sucesso.",
        "data" => ["id" => $meta_id, "ativo" => false]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => 0,
        "message" => "Erro ao finalizar meta: " . $e->getMessage()
    ]);
}
?>