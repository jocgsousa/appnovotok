<?php
// Definindo os cabeçalhos CORS explicitamente para este endpoint
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");

// Se for uma requisição OPTIONS, retornar imediatamente
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Definir cabeçalho Content-Type após CORS
header("Content-Type: application/json");

// Incluir arquivos necessários
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

    // Ler os dados enviados no corpo da requisição
    $data = json_decode(file_get_contents("php://input"), true);

    // Verificar se o ID da filial foi enviado
    if (!isset($data['id'])) {
        http_response_code(400);
        echo json_encode(["message" => "ID da filial não fornecido."]);
        exit;
    }

    $filial_id = $data['id'];

    // Verificar se a filial existe
    $stmt = $db->prepare("SELECT COUNT(*) FROM filiais WHERE id = :id");
    $stmt->execute(['id' => $filial_id]);
    $filialExists = $stmt->fetchColumn();

    if (!$filialExists) {
        http_response_code(404);
        echo json_encode(["message" => "Filial não encontrada."]);
        exit;
    }

    try {
        // Verificar se existem vendedores associados a esta filial
        $stmt = $db->prepare("SELECT COUNT(*) FROM vendedores WHERE filial_id = :filial_id");
        $stmt->execute(['filial_id' => $filial_id]);
        $vendedoresCount = $stmt->fetchColumn();

        if ($vendedoresCount > 0) {
            http_response_code(400);
            echo json_encode([
                "message" => "Não é possível excluir a filial pois existem vendedores associados a ela.",
                "vendedores_count" => $vendedoresCount
            ]);
            exit;
        }

        // Deletar a filial
        $stmt = $db->prepare("DELETE FROM filiais WHERE id = :id");
        $stmt->execute(['id' => $filial_id]);

        echo json_encode(["message" => "Filial excluída com sucesso!"]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Erro ao excluir filial: " . $e->getMessage()]);
    }
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(["message" => "Falha ao realizar requisição", "Erro:" => $e->getMessage()]);
}
?> 