<?php
require_once 'cors_config.php';
require_once 'database.php';

// Definir cabeçalho para resposta JSON
header('Content-Type: application/json');

// Verificar se a requisição é GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit;
}

try {
    // Inicializar a conexão com o banco de dados
    $database = new Database();
    $conn = $database->getConnection();

    // Consultar configurações
    $sql = "SELECT automatic FROM config_cadastro_clientes ORDER BY id DESC LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->execute();

    if ($stmt->rowCount() == 0) {
        // Se não existir configuração, criar uma padrão
        $sqlInsert = "INSERT INTO config_cadastro_clientes (timer, automatic) VALUES (3000, 0)";
        $conn->exec($sqlInsert);
        
        // Consultar novamente
        $stmt = $conn->prepare($sql);
        $stmt->execute();
    }

    $config = $stmt->fetch(PDO::FETCH_ASSOC);
    $automatic = (bool)$config['automatic'];
    
    echo json_encode([
        'success' => true,
        'automatic' => $automatic,
        'message' => $automatic ? 'Sistema em modo automático' : 'Sistema em modo manual'
    ]);

} catch (PDOException $e) {
    error_log("Erro PDO ao verificar configuração: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao consultar banco de dados: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Erro ao verificar configuração: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 