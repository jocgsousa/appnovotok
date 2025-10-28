<?php
header('Content-Type: application/json');
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

// Verificar método HTTP
$method = $_SERVER['REQUEST_METHOD'];

// Verificar autenticação JWT
$headers = getallheaders();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
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

try {
    $database = new Database();
    $pdo = $database->getConnection();

    switch ($method) {
        case 'GET':
            // Listar todas as instâncias
            if (isset($_GET['id'])) {
                // Buscar instância específica
                $stmt = $pdo->prepare("
                    SELECT id, nome, identificador, numero_whatsapp, status, status_conexao, 
                           qrcode, session_path, max_envios_por_minuto, timeout_conversa_minutos,
                           data_cadastro, data_atualizacao, ultima_conexao
                    FROM instancias_whatsapp 
                    WHERE id = ?
                ");
                $stmt->execute([$_GET['id']]);
                $instance = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$instance) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Instância não encontrada']);
                    exit;
                }
                
                echo json_encode($instance);
            } else {
                // Listar todas as instâncias
                $stmt = $pdo->prepare("
                    SELECT id, nome, identificador, numero_whatsapp, status, status_conexao, 
                           qrcode, session_path, max_envios_por_minuto, timeout_conversa_minutos,
                           data_cadastro, data_atualizacao, ultima_conexao
                    FROM instancias_whatsapp 
                    ORDER BY nome
                ");
                $stmt->execute();
                $instances = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                echo json_encode($instances);
            }
            break;

        case 'POST':
            // Criar nova instância
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!isset($input['nome']) || !isset($input['identificador'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Nome e identificador são obrigatórios']);
                exit;
            }

            // Verificar se identificador já existe
            $stmt = $pdo->prepare("SELECT id FROM instancias_whatsapp WHERE identificador = ?");
            $stmt->execute([$input['identificador']]);
            if ($stmt->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'Identificador já existe']);
                exit;
            }

            $stmt = $pdo->prepare("
                INSERT INTO instancias_whatsapp 
                (nome, identificador, numero_whatsapp, url_webhook, token_api, max_envios_por_minuto, timeout_conversa_minutos, status_conexao) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'desconectado')
            ");
            
            $stmt->execute([
                $input['nome'],
                $input['identificador'],
                $input['numero_whatsapp'] ?? null,
                $input['url_webhook'] ?? null,
                $input['token_api'] ?? null,
                $input['max_envios_por_minuto'] ?? 10,
                $input['timeout_conversa_minutos'] ?? 30
            ]);

            $instanceId = $pdo->lastInsertId();
            
            // Notificar o WhatsApp Manager para inicializar a nova instância
            notifyWhatsAppManager('create_instance', $instanceId);
            
            echo json_encode([
                'success' => true,
                'id' => $instanceId,
                'message' => 'Instância criada com sucesso'
            ]);
            break;

        case 'PUT':
            // Atualizar instância existente
            if (!isset($_GET['id'])) {
                http_response_code(400);
                echo json_encode(['error' => 'ID da instância é obrigatório']);
                exit;
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $instanceId = $_GET['id'];

            // Verificar se instância existe
            $stmt = $pdo->prepare("SELECT id FROM instancias_whatsapp WHERE id = ?");
            $stmt->execute([$instanceId]);
            if (!$stmt->fetch()) {
                http_response_code(404);
                echo json_encode(['error' => 'Instância não encontrada']);
                exit;
            }

            $updateFields = [];
            $params = [];

            if (isset($input['nome'])) {
                $updateFields[] = 'nome = ?';
                $params[] = $input['nome'];
            }
            if (isset($input['numero_whatsapp'])) {
                $updateFields[] = 'numero_whatsapp = ?';
                $params[] = $input['numero_whatsapp'];
            }
            if (isset($input['url_webhook'])) {
                $updateFields[] = 'url_webhook = ?';
                $params[] = $input['url_webhook'];
            }
            if (isset($input['token_api'])) {
                $updateFields[] = 'token_api = ?';
                $params[] = $input['token_api'];
            }
            if (isset($input['status'])) {
                $updateFields[] = 'status = ?';
                $params[] = $input['status'];
            }
            if (isset($input['max_envios_por_minuto'])) {
                $updateFields[] = 'max_envios_por_minuto = ?';
                $params[] = $input['max_envios_por_minuto'];
            }
            if (isset($input['timeout_conversa_minutos'])) {
                $updateFields[] = 'timeout_conversa_minutos = ?';
                $params[] = $input['timeout_conversa_minutos'];
            }

            if (empty($updateFields)) {
                http_response_code(400);
                echo json_encode(['error' => 'Nenhum campo para atualizar']);
                exit;
            }

            $updateFields[] = 'data_atualizacao = NOW()';
            $params[] = $instanceId;

            $sql = "UPDATE instancias_whatsapp SET " . implode(', ', $updateFields) . " WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);

            echo json_encode([
                'success' => true,
                'message' => 'Instância atualizada com sucesso'
            ]);
            break;

        case 'DELETE':
            // Deletar instância
            if (!isset($_GET['id'])) {
                http_response_code(400);
                echo json_encode(['error' => 'ID da instância é obrigatório']);
                exit;
            }

            $instanceId = $_GET['id'];

            // Verificar se instância existe
            $stmt = $pdo->prepare("SELECT id, nome FROM instancias_whatsapp WHERE id = ?");
            $stmt->execute([$instanceId]);
            $instance = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$instance) {
                http_response_code(404);
                echo json_encode(['error' => 'Instância não encontrada']);
                exit;
            }

            // Verificar se há campanhas NPS vinculadas a esta instância
            $stmt = $pdo->prepare("SELECT COUNT(*) as count, GROUP_CONCAT(nome SEPARATOR ', ') as campanhas FROM campanhas_nps WHERE instancia_id = ?");
            $stmt->execute([$instanceId]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($result['count'] > 0) {
                http_response_code(400);
                echo json_encode([
                    'error' => 'Não é possível deletar a instância "' . $instance['nome'] . '" pois ela possui campanhas NPS vinculadas.',
                    'details' => 'Campanhas vinculadas: ' . $result['campanhas'],
                    'suggestion' => 'Remova ou transfira as campanhas para outra instância antes de deletar.'
                ]);
                exit;
            }

            // Notificar o WhatsApp Manager para parar a instância
            notifyWhatsAppManager('stop_instance', $instanceId);

            // Contar registros que serão desvinculados (para informação)
            $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM controle_envios_nps WHERE instancia_id = ?");
            $stmt->execute([$instanceId]);
            $controleCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
            
            $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM estado_conversa_nps WHERE instancia_id = ?");
            $stmt->execute([$instanceId]);
            $estadoCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
            
            $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM respostas_nps WHERE instancia_id = ?");
            $stmt->execute([$instanceId]);
            $respostaCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
            
            $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM log_mensagens_whatsapp WHERE instancia_id = ?");
            $stmt->execute([$instanceId]);
            $logCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

            // Deletar instância (ON DELETE SET NULL desvincula automaticamente os registros relacionados)
            $stmt = $pdo->prepare("DELETE FROM instancias_whatsapp WHERE id = ?");
            $stmt->execute([$instanceId]);

            echo json_encode([
                'success' => true,
                'message' => 'Instância deletada com sucesso',
                'details' => [
                    'info' => 'Registros históricos preservados com instância desvinculada',
                    'controle_envios_desvinculados' => $controleCount,
                    'estados_conversa_desvinculados' => $estadoCount,
                    'respostas_desvinculadas' => $respostaCount,
                    'logs_mensagens_desvinculados' => $logCount
                ]
            ]);
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

// Função para notificar o WhatsApp Manager sobre mudanças
function notifyWhatsAppManager($action, $instanceId) {
    try {
        $whatsappManagerUrl = 'http://localhost:3001/api/instances';
        
        switch ($action) {
            case 'create_instance':
                // Fazer requisição para inicializar nova instância
                $ch = curl_init($whatsappManagerUrl . '/' . $instanceId . '/restart');
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 5);
                curl_exec($ch);
                curl_close($ch);
                break;
                
            case 'stop_instance':
                // Fazer requisição para parar instância
                $ch = curl_init($whatsappManagerUrl . '/' . $instanceId . '/stop');
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 5);
                curl_exec($ch);
                curl_close($ch);
                break;
        }
    } catch (Exception $e) {
        // Log do erro, mas não interromper o fluxo principal
        error_log("Erro ao notificar WhatsApp Manager: " . $e->getMessage());
    }
}
?>
