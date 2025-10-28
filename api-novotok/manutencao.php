<?php
require_once 'cors_config.php';
require_once 'database.php';

// Retorna o status de manutenção do sistema
// 0 = sistema operacional
// 1 = sistema em manutenção

// Resposta em formato JSON
header('Content-Type: application/json');

// Inicializar conexão com o banco de dados
$database = new Database();
$conn = $database->getConnection();

try {
    // Consultar o status de manutenção no banco de dados
    $stmt = $conn->prepare("SELECT status, tipo_manutencao, mensagem, data_inicio, data_fim FROM sistema_manutencao ORDER BY id DESC LIMIT 1");
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($result) {
        echo json_encode([
            'success' => true,
            'manutencao' => (int)$result['status'],
            'tipo_manutencao' => $result['tipo_manutencao'],
            'mensagem' => $result['mensagem'],
            'data_inicio' => $result['data_inicio'],
            'data_fim' => $result['data_fim']
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'manutencao' => 0,
            'tipo_manutencao' => 'geral',
            'mensagem' => 'Sistema operacional',
            'data_inicio' => null,
            'data_fim' => null
        ]);
    }
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'manutencao' => 0,
        'tipo_manutencao' => 'geral',
        'mensagem' => 'Erro ao verificar status de manutenção: ' . $e->getMessage(),
        'data_inicio' => null,
        'data_fim' => null
    ]);
}
?> 