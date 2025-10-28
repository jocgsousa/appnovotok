<?php
// Definindo os cabeçalhos CORS explicitamente para este endpoint
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
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

// Log para depuração
error_log("Iniciando desvincular_vendedor_aparelho.php");

// Inicializar conexão com o banco de dados
$database = new Database();
$db = $database->getConnection();

if (!$db) {
    error_log("Falha na conexão com o banco de dados");
    http_response_code(500);
    echo json_encode(["message" => "Erro de conexão com o banco de dados"]);
    exit;
}

// Verificar se a coluna vendedor_id existe na tabela aparelhos
try {
    $stmt = $db->prepare("SHOW COLUMNS FROM aparelhos LIKE 'vendedor_id'");
    $stmt->execute();
    $column_exists = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$column_exists) {
        error_log("Coluna vendedor_id não existe na tabela aparelhos. Adicionando coluna...");
        
        // Adicionar a coluna vendedor_id à tabela aparelhos
        $stmt = $db->prepare("ALTER TABLE aparelhos ADD COLUMN vendedor_id INT NULL");
        $stmt->execute();
        
        error_log("Coluna vendedor_id adicionada com sucesso");
    }
} catch (PDOException $e) {
    error_log("Erro ao verificar/adicionar coluna vendedor_id: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["message" => "Erro ao verificar estrutura do banco de dados: " . $e->getMessage()]);
    exit;
}

$headers = getallheaders();
if (!isset($headers['Authorization'])) {
    error_log("Token não fornecido");
    http_response_code(401);
    echo json_encode(["message" => "Token não fornecido."]);
    exit;
}

try {
    // Valida o token
    $jwt = str_replace('Bearer ', '', $headers['Authorization']);
    error_log("Validando token: " . substr($jwt, 0, 10) . "...");
    
    $user_id = JwtUtils::validateToken($jwt);

    if (!$user_id) {
        error_log("Token inválido");
        http_response_code(401);
        echo json_encode(["message" => "Token inválido."]);
        exit;
    }

    // Ler os dados enviados no corpo da requisição
    $json_data = file_get_contents("php://input");
    error_log("Dados recebidos: " . $json_data);
    
    $data = json_decode($json_data, true);

    // Verificar se o ID do aparelho foi enviado
    if (!isset($data['aparelho_id'])) {
        error_log("ID do aparelho não fornecido");
        http_response_code(400);
        echo json_encode(["message" => "ID do aparelho é obrigatório."]);
        exit;
    }

    $aparelho_id = $data['aparelho_id'];
    error_log("Desvinculando vendedor do aparelho_id: $aparelho_id");

    // Verificar se o aparelho existe
    $stmt = $db->prepare("SELECT * FROM aparelhos WHERE id = :id");
    $stmt->execute(['id' => $aparelho_id]);
    $aparelho = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$aparelho) {
        error_log("Aparelho não encontrado: $aparelho_id");
        http_response_code(404);
        echo json_encode(["message" => "Aparelho não encontrado."]);
        exit;
    }

    // Verificar se o aparelho está vinculado a algum vendedor
    if (!isset($aparelho['vendedor_id']) || $aparelho['vendedor_id'] === null) {
        error_log("Aparelho não está vinculado a nenhum vendedor: $aparelho_id");
        http_response_code(400);
        echo json_encode(["message" => "Este aparelho não está vinculado a nenhum vendedor."]);
        exit;
    }

    try {
        // Desvincular o vendedor do aparelho
        $stmt = $db->prepare("UPDATE aparelhos SET vendedor_id = NULL WHERE id = :id");
        $stmt->execute(['id' => $aparelho_id]);
        
        error_log("Desvinculação realizada com sucesso");

        echo json_encode([
            "success" => true,
            "message" => "Vendedor desvinculado do aparelho com sucesso!",
            "aparelho" => [
                "id" => $aparelho_id,
                "codaparelho" => $aparelho['codaparelho']
            ]
        ]);
    } catch (PDOException $e) {
        error_log("Erro PDO ao desvincular: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["message" => "Erro ao desvincular vendedor do aparelho: " . $e->getMessage()]);
    }
} catch (\Throwable $e) {
    error_log("Exceção geral: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["message" => "Falha ao realizar requisição", "erro" => $e->getMessage()]);
}
?> 