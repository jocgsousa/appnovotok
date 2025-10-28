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

// Verificando se o ID foi fornecido
if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "ID do vendedor é obrigatório e deve ser numérico."]);
    exit;
}

$id = $_GET['id'];

try {
    // Conectando ao banco de dados
    $database = new Database();
    $db = $database->getConnection();

    // Consultar vendedor com informações da filial
    $query = "SELECT v.*, f.nome_fantasia as filial_nome, f.codigo as filial_codigo 
              FROM vendedores v 
              LEFT JOIN filiais f ON v.filial_id = f.id 
              WHERE v.id = :id 
              LIMIT 1";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':id', $id);
    $stmt->execute();

    if ($stmt->rowCount() == 0) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Vendedor não encontrado."]);
        exit;
    }

    $vendedor = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Formatar dados do vendedor
    $result = [
        "id" => (int)$vendedor['id'],
        "rca" => $vendedor['rca'],
        "nome" => $vendedor['nome'],
        "email" => $vendedor['email'],
        "filial_id" => $vendedor['filial_id'] ? (int)$vendedor['filial_id'] : null,
        "ativo" => (bool)$vendedor['ativo'],
        "created_at" => $vendedor['created_at'],
        "updated_at" => $vendedor['updated_at']
    ];
    
    // Adicionar informações da filial se existir
    if ($vendedor['filial_id']) {
        $result['filial'] = [
            "id" => (int)$vendedor['filial_id'],
            "nome" => $vendedor['filial_nome'],
            "codigo" => $vendedor['filial_codigo']
        ];
    }

    echo json_encode([
        "success" => true,
        "vendedor" => $result
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erro no servidor.", "error" => $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erro inesperado.", "error" => $e->getMessage()]);
} 