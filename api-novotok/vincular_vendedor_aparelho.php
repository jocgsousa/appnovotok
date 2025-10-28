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
error_log("Iniciando vincular_vendedor_aparelho.php");

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

    // Verificar se os IDs do aparelho e do vendedor foram enviados
    if (!isset($data['aparelho_id'], $data['vendedor_id'])) {
        error_log("IDs do aparelho e/ou vendedor não fornecidos");
        http_response_code(400);
        echo json_encode(["message" => "IDs do aparelho e do vendedor são obrigatórios."]);
        exit;
    }

    $aparelho_id = intval($data['aparelho_id']);
    $vendedor_id = intval($data['vendedor_id']);
    
    error_log("Vinculando aparelho_id: $aparelho_id com vendedor_id: $vendedor_id");

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

    // Verificar se o vendedor existe e está ativo
    $stmt = $db->prepare("SELECT * FROM vendedores WHERE id = :id");
    $stmt->execute(['id' => $vendedor_id]);
    $vendedor = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$vendedor) {
        error_log("Vendedor não encontrado: $vendedor_id");
        http_response_code(404);
        echo json_encode(["message" => "Vendedor não encontrado (ID: $vendedor_id). Verifique se o vendedor existe no banco de dados."]);
        exit;
    }

    if (!$vendedor['ativo']) {
        error_log("Vendedor inativo: $vendedor_id");
        http_response_code(400);
        echo json_encode(["message" => "Não é possível vincular um aparelho a um vendedor inativo."]);
        exit;
    }

    // Verificar se o ID do vendedor é válido na tabela vendedores
    $stmt = $db->prepare("SELECT COUNT(*) FROM vendedores WHERE id = :id");
    $stmt->execute(['id' => $vendedor_id]);
    $count = $stmt->fetchColumn();
    
    if ($count == 0) {
        error_log("ID de vendedor inválido: $vendedor_id");
        http_response_code(400);
        echo json_encode(["message" => "ID de vendedor inválido. Este ID não existe na tabela de vendedores."]);
        exit;
    }

    // Listar todos os IDs de vendedores disponíveis para depuração
    $stmt = $db->query("SELECT id FROM vendedores ORDER BY id");
    $vendedores_ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
    error_log("IDs de vendedores disponíveis: " . implode(', ', $vendedores_ids));

    try {
        // Vincular o vendedor ao aparelho
        $stmt = $db->prepare("UPDATE aparelhos SET vendedor_id = :vendedor_id WHERE id = :id");
        $stmt->execute([
            'vendedor_id' => $vendedor_id,
            'id' => $aparelho_id
        ]);
        
        error_log("Vinculação realizada com sucesso");

        echo json_encode([
            "success" => true,
            "message" => "Vendedor vinculado ao aparelho com sucesso!",
            "aparelho" => [
                "id" => $aparelho_id,
                "codaparelho" => $aparelho['codaparelho']
            ],
            "vendedor" => [
                "id" => $vendedor_id,
                "nome" => $vendedor['nome'],
                "rca" => $vendedor['rca']
            ]
        ]);
    } catch (PDOException $e) {
        error_log("Erro PDO ao vincular: " . $e->getMessage());
        
        // Verificar se é um erro de chave estrangeira
        if ($e->getCode() == 23000) {
            http_response_code(400);
            echo json_encode([
                "message" => "Erro de chave estrangeira. O ID do vendedor ($vendedor_id) não é válido.",
                "detalhes" => $e->getMessage(),
                "vendedores_disponiveis" => $vendedores_ids
            ]);
        } else {
            http_response_code(500);
            echo json_encode(["message" => "Erro ao vincular vendedor ao aparelho: " . $e->getMessage()]);
        }
    }
} catch (\Throwable $e) {
    error_log("Exceção geral: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["message" => "Falha ao realizar requisição", "erro" => $e->getMessage()]);
}
?> 