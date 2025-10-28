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

    // Obter ação da URL
    $action = $_GET['action'] ?? '';
    $instanceId = $_GET['id'] ?? '';

    if (!$instanceId) {
        http_response_code(400);
        echo json_encode(['error' => 'ID da instância é obrigatório']);
        exit;
    }

    // Verificar se instância existe
    $stmt = $pdo->prepare("SELECT * FROM instancias_whatsapp WHERE id = ?");
    $stmt->execute([$instanceId]);
    $instance = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$instance) {
        http_response_code(404);
        echo json_encode(['error' => 'Instância não encontrada']);
        exit;
    }

    switch ($action) {
        case 'restart':
            // Reiniciar instância
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['error' => 'Método deve ser POST']);
                exit;
            }

            // Atualizar status para conectando
            $stmt = $pdo->prepare("UPDATE instancias_whatsapp SET status_conexao = 'conectando', qrcode = NULL, data_atualizacao = NOW() WHERE id = ?");
            $stmt->execute([$instanceId]);

            // Notificar WhatsApp Manager
            $response = notifyWhatsAppManager('restart', $instanceId);
            
            echo json_encode([
                'success' => true,
                'message' => 'Instância reiniciada com sucesso',
                'instance' => $instance['identificador']
            ]);
            break;

        case 'stop':
            // Parar instância
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['error' => 'Método deve ser POST']);
                exit;
            }

            // Atualizar status para desconectado
            $stmt = $pdo->prepare("UPDATE instancias_whatsapp SET status_conexao = 'desconectado', qrcode = NULL, data_atualizacao = NOW() WHERE id = ?");
            $stmt->execute([$instanceId]);

            // Notificar WhatsApp Manager
            $response = notifyWhatsAppManager('stop', $instanceId);
            
            echo json_encode([
                'success' => true,
                'message' => 'Instância parada com sucesso',
                'instance' => $instance['identificador']
            ]);
            break;

        case 'send_message':
            // Enviar mensagem
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['error' => 'Método deve ser POST']);
                exit;
            }

            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!isset($input['to']) || !isset($input['message'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Parâmetros "to" e "message" são obrigatórios']);
                exit;
            }

            // Verificar se instância está conectada
            if ($instance['status_conexao'] !== 'conectado') {
                http_response_code(400);
                echo json_encode(['error' => 'Instância não está conectada']);
                exit;
            }

            // Enviar mensagem via WhatsApp Manager
            $response = sendMessageViaManager($instanceId, $input['to'], $input['message']);
            
            if ($response['success']) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Mensagem enviada com sucesso',
                    'messageId' => $response['messageId'] ?? null
                ]);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'Erro ao enviar mensagem: ' . $response['error']]);
            }
            break;

        case 'get_qrcode':
            // Obter QR Code atual
            if ($method !== 'GET') {
                http_response_code(405);
                echo json_encode(['error' => 'Método deve ser GET']);
                exit;
            }

            echo json_encode([
                'success' => true,
                'qrcode' => $instance['qrcode'],
                'status' => $instance['status_conexao'],
                'instance' => $instance['identificador']
            ]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Ação não reconhecida']);
            break;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro interno do servidor: ' . $e->getMessage()]);
}

// Função para notificar o WhatsApp Manager
function notifyWhatsAppManager($action, $instanceId) {
    $whatsappManagerUrl = 'http://localhost:3001/api/instances';
    
    try {
        $ch = curl_init();
        
        switch ($action) {
            case 'restart':
                curl_setopt($ch, CURLOPT_URL, $whatsappManagerUrl . '/' . $instanceId . '/restart');
                curl_setopt($ch, CURLOPT_POST, true);
                break;
                
            case 'stop':
                curl_setopt($ch, CURLOPT_URL, $whatsappManagerUrl . '/' . $instanceId . '/stop');
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
                break;
        }
        
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        return [
            'success' => $httpCode >= 200 && $httpCode < 300,
            'response' => $response,
            'httpCode' => $httpCode
        ];
        
    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

// Função para enviar mensagem via WhatsApp Manager
function sendMessageViaManager($instanceId, $to, $message) {
    $whatsappManagerUrl = 'http://localhost:3001/api/instances/' . $instanceId . '/send-message';
    
    try {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $whatsappManagerUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'to' => $to,
            'message' => $message
        ]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode >= 200 && $httpCode < 300) {
            $responseData = json_decode($response, true);
            return [
                'success' => true,
                'messageId' => $responseData['messageId'] ?? null
            ];
        } else {
            return [
                'success' => false,
                'error' => 'HTTP ' . $httpCode . ': ' . $response
            ];
        }
        
    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}
?>
