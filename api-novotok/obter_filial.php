<?php
// Incluir configurações CORS globais primeiro
require_once 'cors_config.php';
header("Access-Control-Allow-Methods: GET, OPTIONS");
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

    // Verificar se o ID da filial foi enviado
    if (!isset($_GET['id'])) {
        http_response_code(400);
        echo json_encode(["message" => "ID da filial não fornecido."]);
        exit;
    }

    $filial_id = $_GET['id'];

    try {
        // Consultar os dados da filial
        $stmt = $db->prepare("SELECT * FROM filiais WHERE id = :id");
        $stmt->execute(['id' => $filial_id]);
        $filial = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$filial) {
            http_response_code(404);
            echo json_encode(["message" => "Filial não encontrada."]);
            exit;
        }

        echo json_encode($filial);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Erro ao consultar filial: " . $e->getMessage()]);
    }
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(["message" => "Falha ao realizar requisição", "Erro:" => $e->getMessage()]);
}
?>