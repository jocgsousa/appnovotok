<?php
header('Content-Type: application/json');
require_once 'cors_config.php';
require_once 'database.php';

// Endpoint de teste simples sem autenticação JWT
try {
    $database = new Database();
    $pdo = $database->getConnection();
    
    // Testar conexão com banco
    $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM instancias_whatsapp");
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'message' => 'API funcionando corretamente',
        'total_instances' => $result['total'],
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?>
