<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

require_once 'database.php';
require_once 'jwt_utils.php';
require_once 'cors_config.php';

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit();
}

// Validar token
$token = get_bearer_token();
if (!$token || !is_jwt_valid($token)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token inválido ou expirado']);
    exit();
}

try {
    $db = new Database();
    $pdo = $db->getConnection();

    // Garantir tabela (idempotente)
    $pdo->exec("CREATE TABLE IF NOT EXISTS bijou_filial_secoes_config (
        filial_id INT NOT NULL PRIMARY KEY,
        departamentos VARCHAR(1000) NULL,
        secoes VARCHAR(2000) NULL,
        ativo TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $stmt = $pdo->prepare("SELECT filial_id, departamentos, secoes, ativo FROM bijou_filial_secoes_config ORDER BY filial_id ASC");
    $stmt->execute();

    $items = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $departamentosCsv = isset($row['departamentos']) ? trim($row['departamentos']) : '';
        $secoesCsv = isset($row['secoes']) ? trim($row['secoes']) : '';
        $departamentos = $departamentosCsv !== '' ? array_filter(array_map('trim', explode(',', $departamentosCsv))) : [];
        $secoes = $secoesCsv !== '' ? array_filter(array_map('trim', explode(',', $secoesCsv))) : [];

        $items[] = [
            'filial_id' => (int) $row['filial_id'],
            'departamentos' => array_values($departamentos),
            'secoes' => array_values($secoes),
            'ativo' => (bool) $row['ativo']
        ];
    }

    echo json_encode(['success' => true, 'data' => $items]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao listar configuração de seções por filial', 'error' => $e->getMessage()]);
}
?>