<?php
require_once 'cors_config.php';
// Inclui a classe Database
require_once 'database.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit();
}

// Instancia a classe Database
$database = new Database();
$conn = $database->getConnection();

try {
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Dados JSON inválidos');
    }
    
    // Validate required fields
    $required_fields = ['device_id', 'vendedor_codigo'];
    foreach ($required_fields as $field) {
        if (!isset($input[$field]) || empty(trim($input[$field]))) {
            throw new Exception("Campo obrigatório: $field");
        }
    }
    
    $device_id = trim($input['device_id']);
    $vendedor_codigo = trim($input['vendedor_codigo']);
    $device_info = isset($input['device_info']) ? $input['device_info'] : null;
    
    // Validate device_id format (should be a unique identifier)
    if (strlen($device_id) < 10) {
        throw new Exception('ID do dispositivo deve ter pelo menos 10 caracteres');
    }
    
    // Find vendor by code (RCA)
    $stmt = $conn->prepare("SELECT id, nome, ativo FROM vendedores WHERE rca = ? AND ativo = 1");
    $stmt->execute([$vendedor_codigo]);
    $vendedor = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$vendedor) {
        throw new Exception('Vendedor não encontrado ou inativo');
    }
    
    $vendedor_id = $vendedor['id'];
    
    // Check if device is already registered
    $stmt = $conn->prepare("SELECT id, vendedor_id FROM aparelhos WHERE codaparelho = ?");
    $stmt->execute([$device_id]);
    $existing_device = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($existing_device) {
        if ($existing_device['vendedor_id'] == $vendedor_id) {
            // Device already linked to this vendor - update autorized status
            $stmt = $conn->prepare("UPDATE aparelhos SET autorized = 1, vendedor_id = ? WHERE codaparelho = ?");
            $stmt->execute([$vendedor_id, $device_id]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Dispositivo já vinculado a este vendedor',
                'action' => 'updated',
                'device_id' => $device_id,
                'vendedor' => [
                    'id' => $vendedor_id,
                    'codigo' => $vendedor_codigo,
                    'nome' => $vendedor['nome']
                ]
            ]);
        } else {
            // Device linked to another vendor - reassign
            $stmt = $conn->prepare("UPDATE aparelhos SET vendedor_id = ?, autorized = 1 WHERE codaparelho = ?");
            $stmt->execute([$vendedor_id, $device_id]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Dispositivo revinculado com sucesso',
                'action' => 'reassigned',
                'device_id' => $device_id,
                'vendedor' => [
                    'id' => $vendedor_id,
                    'codigo' => $vendedor_codigo,
                    'nome' => $vendedor['nome']
                ]
            ]);
        }
    } else {
        // Register new device
        $stmt = $conn->prepare("INSERT INTO aparelhos (codaparelho, vendedor_id, autorized) VALUES (?, ?, 1)");
        $stmt->execute([$device_id, $vendedor_id]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Dispositivo vinculado com sucesso',
            'action' => 'created',
            'device_id' => $device_id,
            'vendedor' => [
                'id' => $vendedor_id,
                'codigo' => $vendedor_codigo,
                'nome' => $vendedor['nome']
            ]
        ]);
    }
    
} catch (PDOException $e) {
    error_log("Database error in vincular_mobile.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor',
        'error_code' => 'DB_ERROR'
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
