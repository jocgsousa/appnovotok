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
        // Função de log simples para depuração
        $logFile = __DIR__ . '/logs/nps_estado_conversa.log';
        $log = function($msg, $data = []) use ($logFile) {
            $ts = date('Y-m-d H:i:s');
            $line = '[' . $ts . '] ' . $msg . (empty($data) ? '' : ' ' . json_encode($data)) . "\n";
            @file_put_contents($logFile, $line, FILE_APPEND);
        };
        // Criar estado de conversa
        // Compatibilidade: aceitar tanto controle_id quanto controle_envio_id
        $controleEnvioId = $input['controle_envio_id'] ?? $input['controle_id'] ?? null;
        $instanciaId = $input['instancia_id'] ?? null;
        $celular = $input['celular'] ?? null;

        $log('POST estado-conversa recebido', [
            'controle_envio_id' => $controleEnvioId,
            'instancia_id' => $instanciaId,
            'celular' => $celular,
            'pedido_id' => $input['pedido_id'] ?? null,
            'campanha_id' => $input['campanha_id'] ?? null
        ]);

        // Fallback: permitir localizar controle pelo pedido/campanha quando controle_envio_id não for informado
        if (!$controleEnvioId && isset($input['pedido_id']) && isset($input['campanha_id'])) {
            $checkByPedido = $conn->prepare("SELECT id, instancia_id, celular FROM controle_envios_nps WHERE pedido_id = ? AND campanha_id = ? LIMIT 1");
            $checkByPedido->execute([$input['pedido_id'], $input['campanha_id']]);
            $byPedido = $checkByPedido->fetch(PDO::FETCH_ASSOC);
            if ($byPedido) {
                $controleEnvioId = (int)$byPedido['id'];
                // Se não vier instancia_id/celular no corpo, usar os do controle
                if (!$instanciaId && isset($byPedido['instancia_id'])) {
                    $instanciaId = (int)$byPedido['instancia_id'];
                }
                if (!$celular && isset($byPedido['celular'])) {
                    $celular = $byPedido['celular'];
                }
                $log('Controle localizado por fallback pedido/campanha', ['controle_envio_id' => $controleEnvioId]);
            }
        }

        // Validar campos obrigatórios após aliases e fallback
        $requiredFields = ['controle_envio_id', 'instancia_id', 'celular'];
        if (!$controleEnvioId) {
            http_response_code(400);
            echo json_encode(['error' => "Campo 'controle_envio_id' é obrigatório"]);
            exit;
        }
        if (!$instanciaId) {
            http_response_code(400);
            echo json_encode(['error' => "Campo 'instancia_id' é obrigatório"]);
            exit;
        }
        if (!$celular) {
            http_response_code(400);
            echo json_encode(['error' => "Campo 'celular' é obrigatório"]);
            exit;
        }
        
        // Validar existência do controle de envio (FK) com transação e lock para consistência
        $conn->beginTransaction();
        try {
            $checkControle = $conn->prepare("SELECT id, instancia_id, celular FROM controle_envios_nps WHERE id = ? FOR UPDATE");
            $checkControle->execute([$controleEnvioId]);
            $controle = $checkControle->fetch(PDO::FETCH_ASSOC);
            if ($controle) {
                $log('Controle encontrado e travado (FOR UPDATE)', ['controle_envio_id' => (int)$controleEnvioId]);
            }
        } catch (Exception $e) {
            // Falha ao travar registro: fazer verificação sem FOR UPDATE
            $log('Falha ao aplicar FOR UPDATE, verificando sem lock', ['controle_envio_id' => (int)$controleEnvioId, 'error' => $e->getMessage()]);
            $checkControle = $conn->prepare("SELECT id, instancia_id, celular FROM controle_envios_nps WHERE id = ?");
            $checkControle->execute([$controleEnvioId]);
            $controle = $checkControle->fetch(PDO::FETCH_ASSOC);
        }
        
        if (!$controle) {
            // Novo: tentar recuperar via pedido_id + campanha_id mesmo quando um controle_id inválido foi enviado
            if (isset($input['pedido_id']) && isset($input['campanha_id'])) {
                $checkByPedido = $conn->prepare("SELECT id, instancia_id, celular FROM controle_envios_nps WHERE pedido_id = ? AND campanha_id = ? LIMIT 1");
                $checkByPedido->execute([$input['pedido_id'], $input['campanha_id']]);
                $byPedido = $checkByPedido->fetch(PDO::FETCH_ASSOC);
                if ($byPedido) {
                    $controleEnvioId = (int)$byPedido['id'];
                    $instanciaId = $instanciaId ?: (int)$byPedido['instancia_id'];
                    $celular = $celular ?: $byPedido['celular'];
                    $controle = $byPedido; // prosseguir usando controle localizado
                }
            }

            if (!$controle) {
                $conn->rollBack();
                http_response_code(404);
                echo json_encode([
                    'error' => 'controle_envio_id não encontrado em controle_envios_nps',
                    'controle_envio_id' => (int)$controleEnvioId
                ]);
                exit;
            }
        }
        
        // Idempotência: verificar se já existe estado para este controle
        $checkEstado = $conn->prepare("SELECT id FROM estado_conversa_nps WHERE controle_envio_id = ? LIMIT 1");
        $checkEstado->execute([$controleEnvioId]);
        $estadoExistente = $checkEstado->fetch(PDO::FETCH_ASSOC);
        
        if ($estadoExistente) {
            $conn->commit();
            echo json_encode([
                'success' => true,
                'id' => (int)$estadoExistente['id'],
                'estado' => ['id' => (int)$estadoExistente['id']],
                'existing' => true,
                'message' => 'Estado de conversa já existia para este controle'
            ]);
            exit;
        }
        
        $query = "INSERT INTO estado_conversa_nps 
                  (controle_envio_id, instancia_id, celular, pergunta_atual_id, ordem_resposta, aguardando_resposta, proxima_acao, data_timeout) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $conn->prepare($query);
        try {
            $stmt->execute([
                $controleEnvioId,
                $instanciaId,
                $celular,
                $input['pergunta_atual_id'] ?? null,  // NULL em vez de 0 para evitar constraint violation
                $input['ordem_resposta'] ?? 0,
                $input['aguardando_resposta'] ?? true,
                $input['proxima_acao'] ?? 'pergunta_principal',
                $input['data_timeout'] ?? null
            ]);
            // Obter ID antes do commit para evitar inconsistências em alguns drivers
            $id = $conn->lastInsertId();
            $conn->commit();
        } catch (PDOException $e) {
            $conn->rollBack();
            // Tratar violação de integridade referencial (FK) de forma amigável
            if ($e->getCode() === '23000') {
                // Verificar novamente existência do controle para diagnosticar deleção concorrente
                $checkAgain = $conn->prepare("SELECT id FROM controle_envios_nps WHERE id = ?");
                $checkAgain->execute([$controleEnvioId]);
                $existsAgain = $checkAgain->fetch(PDO::FETCH_ASSOC);
                $context = ['controle_envio_id' => (int)$controleEnvioId, 'error' => $e->getMessage(), 'exists_after_fail' => (bool)$existsAgain];
                $log('Falha FK ao inserir estado', $context);
                http_response_code($existsAgain ? 409 : 404);
                echo json_encode([
                    'error' => $existsAgain ? 'Conflito concorrente: controle removido durante criação do estado' : 'Violação de integridade: controle_envio_id inexistente ou removido',
                    'controle_envio_id' => (int)$controleEnvioId,
                    'message' => $e->getMessage(),
                    'exists_after_fail' => (bool)$existsAgain
                ]);
                exit;
            }
            throw $e;
        }
        
        $log('Estado de conversa criado', ['id' => (int)$id, 'controle_envio_id' => (int)$controleEnvioId]);
        echo json_encode([
            'success' => true,
            'id' => (int)$id,
            'estado' => ['id' => (int)$id],
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
