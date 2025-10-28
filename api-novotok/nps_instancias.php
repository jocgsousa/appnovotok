<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

header('Content-Type: application/json');

// Verificar método HTTP
$method = $_SERVER['REQUEST_METHOD'];

try {
    // Verificar token JWT
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['error' => 'Token de autorização não fornecido']);
        exit;
    }
    
    $token = $matches[1];
    $user_id = JwtUtils::validateToken($token);
    
    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['error' => 'Token inválido']);
        exit;
    }

    // Conectar ao banco
    $database = new Database();
    $db = $database->getConnection();

    switch ($method) {
        case 'GET':
            listarInstancias($db);
            break;
        case 'POST':
            criarInstancia($db);
            break;
        case 'PUT':
            atualizarInstancia($db);
            break;
        case 'DELETE':
            deletarInstancia($db);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Método não permitido']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro interno do servidor: ' . $e->getMessage()]);
}

function listarInstancias($db) {
    try {
        $query = "SELECT 
                    id,
                    nome,
                    identificador,
                    url_webhook,
                    numero_whatsapp,
                    status,
                    max_envios_por_minuto,
                    timeout_conversa_minutos,
                    data_cadastro,
                    data_atualizacao
                  FROM instancias_whatsapp 
                  ORDER BY nome";
        
        $stmt = $db->prepare($query);
        $stmt->execute();
        
        $instancias = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $instancias
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao listar instâncias: ' . $e->getMessage()]);
    }
}

function criarInstancia($db) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Validar campos obrigatórios
        $required = ['nome', 'identificador', 'url_webhook', 'token_api', 'numero_whatsapp'];
        foreach ($required as $field) {
            if (!isset($input[$field]) || empty($input[$field])) {
                http_response_code(400);
                echo json_encode(['error' => "Campo '$field' é obrigatório"]);
                return;
            }
        }
        
        // Verificar se identificador já existe
        $checkQuery = "SELECT id FROM instancias_whatsapp WHERE identificador = ?";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->execute([$input['identificador']]);
        
        if ($checkStmt->fetch()) {
            http_response_code(400);
            echo json_encode(['error' => 'Identificador já existe']);
            return;
        }
        
        $query = "INSERT INTO instancias_whatsapp (
                    nome, identificador, url_webhook, token_api, numero_whatsapp,
                    status, max_envios_por_minuto, timeout_conversa_minutos
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $db->prepare($query);
        $stmt->execute([
            $input['nome'],
            $input['identificador'],
            $input['url_webhook'],
            $input['token_api'],
            $input['numero_whatsapp'],
            $input['status'] ?? 'ativa',
            $input['max_envios_por_minuto'] ?? 10,
            $input['timeout_conversa_minutos'] ?? 30
        ]);
        
        $instanciaId = $db->lastInsertId();
        
        echo json_encode([
            'success' => true,
            'message' => 'Instância criada com sucesso',
            'id' => $instanciaId
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao criar instância: ' . $e->getMessage()]);
    }
}

function atualizarInstancia($db) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'ID da instância é obrigatório']);
            return;
        }
        
        // Verificar se instância existe
        $checkQuery = "SELECT id FROM instancias_whatsapp WHERE id = ?";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->execute([$input['id']]);
        
        if (!$checkStmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Instância não encontrada']);
            return;
        }
        
        $query = "UPDATE instancias_whatsapp SET 
                    nome = ?, url_webhook = ?, token_api = ?, numero_whatsapp = ?,
                    status = ?, max_envios_por_minuto = ?, timeout_conversa_minutos = ?,
                    data_atualizacao = CURRENT_TIMESTAMP
                  WHERE id = ?";
        
        $stmt = $db->prepare($query);
        $stmt->execute([
            $input['nome'],
            $input['url_webhook'],
            $input['token_api'],
            $input['numero_whatsapp'],
            $input['status'],
            $input['max_envios_por_minuto'],
            $input['timeout_conversa_minutos'],
            $input['id']
        ]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Instância atualizada com sucesso'
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao atualizar instância: ' . $e->getMessage()]);
    }
}

function deletarInstancia($db) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'ID da instância é obrigatório']);
            return;
        }
        
        // Verificar se há campanhas ativas usando esta instância
        $checkQuery = "SELECT COUNT(*) as count FROM campanhas_nps WHERE instancia_id = ? AND status = 'ativa'";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->execute([$input['id']]);
        $result = $checkStmt->fetch();
        
        if ($result['count'] > 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Não é possível deletar instância com campanhas ativas']);
            return;
        }
        
        $query = "DELETE FROM instancias_whatsapp WHERE id = ?";
        $stmt = $db->prepare($query);
        $stmt->execute([$input['id']]);
        
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Instância não encontrada']);
            return;
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Instância deletada com sucesso'
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao deletar instância: ' . $e->getMessage()]);
    }
}
?>
