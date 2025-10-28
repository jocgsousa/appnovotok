<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'database.php';
require_once 'jwt_utils.php';

// Verificar autenticação JWT
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';

if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode(['error' => 'Token de acesso requerido']);
    exit();
}

$token = $matches[1];
if (!JwtUtils::validateToken($token)) {
    http_response_code(401);
    echo json_encode(['error' => 'Token inválido']);
    exit();
}

$database = new Database();
$pdo = $database->getConnection();

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$pathParts = explode('/', trim($path, '/'));

try {
    switch ($method) {
        case 'GET':
            if (isset($pathParts[3]) && $pathParts[3] === 'count') {
                // GET /api/v1/whatsapp_instances_api/count - Contar instâncias (para teste de conexão)
                $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM instancias_whatsapp");
                $stmt->execute();
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                echo json_encode(['total' => (int)$result['total']]);
                
            } elseif (isset($pathParts[3]) && is_numeric($pathParts[3])) {
                // GET /api/v1/whatsapp_instances_api/{id} - Buscar instância específica
                $id = (int)$pathParts[3];
                $stmt = $pdo->prepare("SELECT * FROM instancias_whatsapp WHERE id = ?");
                $stmt->execute([$id]);
                $instance = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$instance) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Instância não encontrada']);
                } else {
                    echo json_encode($instance);
                }
                
            } elseif (isset($_GET['status'])) {
                // GET /api/v1/whatsapp_instances_api?status=ativa - Buscar por status
                $status = $_GET['status'];
                $stmt = $pdo->prepare("SELECT * FROM instancias_whatsapp WHERE status = ? ORDER BY nome");
                $stmt->execute([$status]);
                $instances = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode($instances);
                
            } elseif (isset($_GET['ids'])) {
                // GET /api/v1/whatsapp_instances_api?ids=1,2,3 - Verificar instâncias por IDs
                $ids = explode(',', $_GET['ids']);
                $placeholders = str_repeat('?,', count($ids) - 1) . '?';
                $stmt = $pdo->prepare("SELECT id FROM instancias_whatsapp WHERE id IN ($placeholders)");
                $stmt->execute($ids);
                $existingIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
                echo json_encode(['existing_ids' => $existingIds]);
                
            } else {
                // GET /api/v1/whatsapp_instances_api - Listar todas as instâncias
                $stmt = $pdo->prepare("
                    SELECT id, nome, identificador, numero_whatsapp, status, status_conexao, 
                           qrcode, ultima_conexao, data_criacao, data_atualizacao 
                    FROM instancias_whatsapp 
                    ORDER BY nome
                ");
                $stmt->execute();
                $instances = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode($instances);
            }
            break;
            
        case 'PUT':
            if (isset($pathParts[3]) && is_numeric($pathParts[3])) {
                // PUT /api/v1/whatsapp_instances_api/{id}/status - Atualizar status da instância
                $id = (int)$pathParts[3];
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!isset($input['status_conexao'])) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Campo status_conexao é obrigatório']);
                    break;
                }
                
                $query = "UPDATE instancias_whatsapp SET status_conexao = ?, data_atualizacao = NOW()";
                $params = [$input['status_conexao']];
                
                // Campos opcionais
                if (isset($input['qrcode'])) {
                    $query .= ", qrcode = ?";
                    $params[] = $input['qrcode'];
                }
                
                if (isset($input['numero_whatsapp'])) {
                    $query .= ", numero_whatsapp = ?, ultima_conexao = NOW()";
                    $params[] = $input['numero_whatsapp'];
                }
                
                $query .= " WHERE id = ?";
                $params[] = $id;
                
                $stmt = $pdo->prepare($query);
                $success = $stmt->execute($params);
                
                if ($success && $stmt->rowCount() > 0) {
                    echo json_encode(['success' => true, 'message' => 'Status atualizado com sucesso']);
                } else {
                    http_response_code(404);
                    echo json_encode(['error' => 'Instância não encontrada']);
                }
            } else {
                http_response_code(400);
                echo json_encode(['error' => 'ID da instância é obrigatório']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Método não permitido']);
            break;
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro interno do servidor: ' . $e->getMessage()]);
}
?>
