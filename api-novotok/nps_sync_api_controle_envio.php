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
        // Criar controle de envio
        $requiredFields = ['instancia_id', 'pedido_id', 'numero_pedido', 'filial', 'caixa', 'codcli', 'celular', 'campanha_id'];
        foreach ($requiredFields as $field) {
            if (!isset($input[$field])) {
                http_response_code(400);
                echo json_encode(['error' => "Campo '$field' é obrigatório"]);
                exit;
            }
        }
        
        // Validar CODCLI (não pode ser 1 devido ao CHECK constraint)
        if ($input['codcli'] == 1) {
            http_response_code(400);
            echo json_encode(['error' => 'CODCLI não pode ser 1']);
            exit;
        }
        
        // Validar status_envio se fornecido
        $validStatuses = ['pendente', 'enviado', 'em_andamento', 'finalizado', 'cancelado', 'erro'];
        $statusEnvio = $input['status_envio'] ?? 'pendente';
        if (!in_array($statusEnvio, $validStatuses)) {
            http_response_code(400);
            echo json_encode(['error' => 'Status de envio inválido. Valores aceitos: ' . implode(', ', $validStatuses)]);
            exit;
        }
        
        // Verificar se já existe um controle para este pedido e campanha (UNIQUE constraint)
        $checkQuery = "SELECT id FROM controle_envios_nps WHERE pedido_id = ? AND campanha_id = ?";
        $checkStmt = $conn->prepare($checkQuery);
        $checkStmt->execute([$input['pedido_id'], $input['campanha_id']]);
        
        if ($checkStmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Já existe um controle de envio para este pedido e campanha']);
            exit;
        }
        
        $query = "INSERT INTO controle_envios_nps 
                  (instancia_id, pedido_id, numero_pedido, filial, caixa, codcli, celular, nome_cliente, email_cliente, campanha_id, token_pesquisa, status_envio, tentativas_envio, data_elegivel, data_envio, ultimo_erro) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $conn->prepare($query);
        $stmt->execute([
            $input['instancia_id'],
            $input['pedido_id'],
            $input['numero_pedido'],
            $input['filial'],
            $input['caixa'],
            $input['codcli'],
            $input['celular'],
            $input['nome_cliente'] ?? null,
            $input['email_cliente'] ?? null,
            $input['campanha_id'],
            $input['token_pesquisa'] ?? bin2hex(random_bytes(16)),
            $statusEnvio,
            $input['tentativas_envio'] ?? 0,
            $input['data_elegivel'] ?? null,
            $input['data_envio'] ?? null,
            $input['ultimo_erro'] ?? null
        ]);
        
        $id = $conn->lastInsertId();
        
        echo json_encode([
            'success' => true,
            'id' => (int)$id,
            'message' => 'Controle de envio criado com sucesso'
        ]);
        
    } else if ($method === 'PUT') {
        // Atualizar controle de envio
        if (!isset($input['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'ID é obrigatório para atualização']);
            exit;
        }
        
        $id = $input['id'];
        unset($input['id']);
        
        // Verificar se o registro existe
        $checkQuery = "SELECT id FROM controle_envios_nps WHERE id = ?";
        $checkStmt = $conn->prepare($checkQuery);
        $checkStmt->execute([$id]);
        
        if (!$checkStmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Controle de envio não encontrado']);
            exit;
        }
        
        // Preparar campos para atualização
        $updateFields = [];
        $updateValues = [];
        
        $allowedFields = ['status_envio', 'tentativas_envio', 'ultimo_erro', 'data_envio', 'data_inicio_conversa', 'data_fim_conversa', 'motivo_cancelamento'];
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
        $updateQuery = "UPDATE controle_envios_nps SET " . implode(', ', $updateFields) . " WHERE id = ?";
        $updateStmt = $conn->prepare($updateQuery);
        $updateStmt->execute($updateValues);
        
        echo json_encode([
            'success' => true,
            'message' => 'Controle de envio atualizado com sucesso'
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
