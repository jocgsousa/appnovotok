<?php
require 'cors_config.php';
header("Content-Type: application/json; charset=UTF-8");

require 'database.php';
require 'jwt_utils.php';

// Reativar meta de loja (somente admin)
if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') {
    http_response_code(405);
    echo json_encode([
        "status" => 0,
        "message" => "Método não permitido. Apenas PATCH é aceito."
    ]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

// Validar token
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

// Conectar ao banco
$database = new Database();
$conn = $database->getConnection();

try {
    // Checar usuário admin e ativo
    $sqlUsuario = "SELECT tipo_usuario, ativo FROM usuarios WHERE id = ?";
    $stmtUsuario = $conn->prepare($sqlUsuario);
    $stmtUsuario->bindValue(1, $usuario_id);
    $stmtUsuario->execute();
    if ($stmtUsuario->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(["status" => 0, "message" => "Usuário não encontrado"]);
        exit;
    }
    $usuario = $stmtUsuario->fetch(PDO::FETCH_ASSOC);
    if (!(int)$usuario['ativo']) {
        http_response_code(403);
        echo json_encode(["status" => 0, "message" => "Usuário inativo. Contate o administrador."]);
        exit;
    }
    if (strtolower(trim($usuario['tipo_usuario'])) !== 'admin') {
        http_response_code(403);
        echo json_encode(["status" => 0, "message" => "Apenas administradores podem reativar metas."]);
        exit;
    }

    // Checar meta
    $sqlCheck = "SELECT id, ativo FROM metas_lojas WHERE id = ?";
    $stmtCheck = $conn->prepare($sqlCheck);
    $stmtCheck->bindValue(1, $meta_id);
    $stmtCheck->execute();
    if ($stmtCheck->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(["status" => 0, "message" => "Meta de loja não encontrada."]);
        exit;
    }
    $meta = $stmtCheck->fetch(PDO::FETCH_ASSOC);

    // Se já estiver ativa, idempotente
    if ((int)$meta['ativo'] === 1) {
        http_response_code(200);
        echo json_encode([
            "status" => 1,
            "message" => "Meta já está ativa.",
            "data" => ["id" => $meta_id, "ativo" => true]
        ]);
        exit;
    }

    // Reativar
    $sqlUpdate = "UPDATE metas_lojas SET ativo = 1 WHERE id = ?";
    $stmtUpdate = $conn->prepare($sqlUpdate);
    $stmtUpdate->bindValue(1, $meta_id);
    $stmtUpdate->execute();

    http_response_code(200);
    echo json_encode([
        "status" => 1,
        "message" => "Meta reativada com sucesso.",
        "data" => ["id" => $meta_id, "ativo" => true]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => 0,
        "message" => "Erro ao reativar meta: " . $e->getMessage()
    ]);
}
?>