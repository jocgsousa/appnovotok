<?php
// Definindo os cabeçalhos CORS para permitir acesso de qualquer origem
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
        // Consulta todos os aparelhos com informações do vendedor associado
        $sql = "SELECT a.id, a.codaparelho, a.autorized, a.vendedor_id, 
                v.nome as vendedor_nome, v.rca as vendedor_rca 
                FROM aparelhos a 
                LEFT JOIN vendedores v ON a.vendedor_id = v.id 
                ORDER BY a.id DESC";
        
        $stmt = $db->prepare($sql);
        $stmt->execute();
        $aparelhos = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Formatar a resposta para incluir informações do vendedor de forma estruturada
        $result = [];
        foreach ($aparelhos as $aparelho) {
            $vendedor = null;
            if ($aparelho['vendedor_id']) {
                $vendedor = [
                    'id' => $aparelho['vendedor_id'],
                    'nome' => $aparelho['vendedor_nome'],
                    'rca' => $aparelho['vendedor_rca']
                ];
            }
            
            $result[] = [
                'id' => $aparelho['id'],
                'codaparelho' => $aparelho['codaparelho'],
                'autorized' => $aparelho['autorized'],
                'vendedor' => $vendedor
            ];
        }

        echo json_encode($result);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Erro ao consultar aparelhos: " . $e->getMessage()]);
    }
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(["message" => "Falha ao realizar requisição", "Erro:" => $e->getMessage()]);
}
?> 