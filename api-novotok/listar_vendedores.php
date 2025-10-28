<?php
// Definindo os cabeçalhos CORS explicitamente para este endpoint
header("Access-Control-Allow-Origin: *");
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

    try {
        // Consulta todos os vendedores com informações da filial associada
        $sql = "SELECT v.id, v.rca, v.nome, v.email, v.ativo, v.filial_id, 
                f.nome_fantasia as filial_nome, f.codigo as filial_codigo
                FROM vendedores v 
                LEFT JOIN filiais f ON v.filial_id = f.id 
                ORDER BY v.nome ASC";
        
        $stmt = $db->prepare($sql);
        $stmt->execute();
        $vendedores = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Formatar a resposta para incluir informações da filial de forma estruturada
        $result = [];
        foreach ($vendedores as $vendedor) {
            $filial = null;
            if ($vendedor['filial_id']) {
                $filial = [
                    'id' => (int)$vendedor['filial_id'],
                    'nome' => $vendedor['filial_nome'],
                    'codigo' => $vendedor['filial_codigo']
                ];
            }
            
            $result[] = [
                'id' => (int)$vendedor['id'],
                'rca' => $vendedor['rca'],
                'nome' => $vendedor['nome'],
                'email' => $vendedor['email'],
                'ativo' => (bool)$vendedor['ativo'],
                'filial' => $filial
            ];
        }

        echo json_encode($result);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Erro ao consultar vendedores: " . $e->getMessage()]);
    }
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(["message" => "Falha ao realizar requisição", "Erro:" => $e->getMessage()]);
}
?> 