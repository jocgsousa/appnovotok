<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

require_once 'database.php';
require_once 'jwt_utils.php';
require_once 'cors_config.php';

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'JSON inválido', 'error' => json_last_error_msg()]);
    exit();
}

if (!isset($payload['vendedor_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Campo vendedor_id é obrigatório']);
    exit();
}

$vendedorId = (int)$payload['vendedor_id'];
$departamentosArr = isset($payload['departamentos']) && is_array($payload['departamentos']) ? $payload['departamentos'] : [];
$secoesArr = isset($payload['secoes']) && is_array($payload['secoes']) ? $payload['secoes'] : [];
$ativo = isset($payload['ativo']) ? (int) (!!$payload['ativo']) : (count($departamentosArr) > 0 || count($secoesArr) > 0 ? 1 : 0);

// Normalizar para CSV
$departamentosCsv = implode(',', array_map('strval', $departamentosArr));
$secoesCsv = implode(',', array_map('strval', $secoesArr));

$departamentosValue = ($departamentosCsv !== '') ? $departamentosCsv : null;
$secoesValue = ($secoesCsv !== '') ? $secoesCsv : null;

try {
    $db = new Database();
    $pdo = $db->getConnection();

    // Garantir tabela (idempotente)
    $pdo->exec("CREATE TABLE IF NOT EXISTS bijou_vendedor_secoes_config (
      vendedor_id INT NOT NULL PRIMARY KEY,
      departamentos VARCHAR(1000) DEFAULT NULL,
      secoes VARCHAR(2000) DEFAULT NULL,
      ativo TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $sql = "INSERT INTO bijou_vendedor_secoes_config (vendedor_id, departamentos, secoes, ativo)
            VALUES (:vendedor_id, :departamentos, :secoes, :ativo)
            ON DUPLICATE KEY UPDATE
              departamentos = VALUES(departamentos),
              secoes = VALUES(secoes),
              ativo = VALUES(ativo)";
    $stmt = $pdo->prepare($sql);

    $stmt->bindValue(':vendedor_id', $vendedorId, PDO::PARAM_INT);
    if ($departamentosValue === null) {
        $stmt->bindValue(':departamentos', null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue(':departamentos', $departamentosValue, PDO::PARAM_STR);
    }
    if ($secoesValue === null) {
        $stmt->bindValue(':secoes', null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue(':secoes', $secoesValue, PDO::PARAM_STR);
    }
    $stmt->bindValue(':ativo', $ativo, PDO::PARAM_INT);
    $stmt->execute();

    echo json_encode(['success' => true, 'message' => 'Configurações de seções por vendedor salvas', 'data' => ['vendedor_id' => $vendedorId]]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao salvar configuração de seções por vendedor', 'error' => $e->getMessage()]);
}
?>