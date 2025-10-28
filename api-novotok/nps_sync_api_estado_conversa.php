<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

header('Content-Type: application/json');

// Verificar método HTTP
$method = $_SERVER['REQUEST_METHOD'];

if (!in_array($method, ['POST', 'PUT'])) {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

try {
    // Verificar autenticação JWT
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['error' => 'Token de acesso requerido']);
        exit;
    }
    
    $token = $matches[1];
    $decoded = JwtUtils::validateToken($token);
    
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['error' => 'Token inválido']);
        exit;
    }

    // Obter dados do corpo da requisição
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Dados inválidos']);
        exit;
    }

    // Conectar ao banco de dados
    $database = new Database();
    $conn = $database->getConnection();
    
    if ($method === 'POST') {
        // Criar estado de conversa
        $requiredFields = ['controle_envio_id', 'instancia_id', 'celular'];
        foreach ($requiredFields as $field) {
            if (!isset($input[$field])) {
                http_response_code(400);
                echo json_encode(['error' => "Campo '$field' é obrigatório"]);
                exit;
            }
        }
        
        $query = "INSERT INTO estado_conversa_nps 
                  (controle_envio_id, instancia_id, celular, pergunta_atual_id, ordem_resposta, aguardando_resposta, proxima_acao, data_timeout) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $conn->prepare($query);
        $stmt->execute([
            $input['controle_envio_id'],
            $input['instancia_id'],
            $input['celular'],
            $input['pergunta_atual_id'] ?? null,  // NULL em vez de 0 para evitar constraint violation
            $input['ordem_resposta'] ?? 0,
            $input['aguardando_resposta'] ?? true,
            $input['proxima_acao'] ?? 'pergunta_principal',
            $input['data_timeout'] ?? null
        ]);
        
        $id = $conn->lastInsertId();
        
        echo json_encode([
            'success' => true,
            'id' => (int)$id,
            'message' => 'Estado de conversa criado com sucesso'
        ]);
        
    } else if ($method === 'PUT') {
        // Atualizar estado de conversa
        if (!isset($input['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'ID é obrigatório para atualização']);
            exit;
        }
        
        $id = $input['id'];
        unset($input['id']);
        
        // Verificar se o registro existe
        $checkQuery = "SELECT id FROM estado_conversa_nps WHERE id = ?";
        $checkStmt = $conn->prepare($checkQuery);
        $checkStmt->execute([$id]);
        
        if (!$checkStmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Estado de conversa não encontrado']);
            exit;
        }
        
        // Preparar campos para atualização
        $updateFields = [];
        $updateValues = [];
        
        $allowedFields = ['pergunta_atual_id', 'ordem_resposta', 'aguardando_resposta', 'proxima_acao', 'data_timeout'];
        foreach ($allowedFields as $field) {
            if (isset($input[$field])) {
                $updateFields[] = "$field = ?";
                $updateValues[] = $input[$field];
            }
        }
        
        if (empty($updateFields)) {
            http_response_code(400);
            echo json_encode(['error' => 'Nenhum campo para atualizar']);
            exit;
        }
        $updateValues[] = $id;
        
        // Executar atualização
        $updateQuery = "UPDATE estado_conversa_nps SET " . implode(', ', $updateFields) . " WHERE id = ?";
        $updateStmt = $conn->prepare($updateQuery);
        $updateStmt->execute($updateValues);
        
        echo json_encode([
            'success' => true,
            'message' => 'Estado de conversa atualizado com sucesso'
        ]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno do servidor',
        'message' => $e->getMessage()
    ]);
}
?>
