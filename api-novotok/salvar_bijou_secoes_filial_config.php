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

if (!isset($payload['items']) || !is_array($payload['items'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Campo "items" é obrigatório e deve ser um array']);
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

    $pdo->beginTransaction();

    $sql = "INSERT INTO bijou_filial_secoes_config (filial_id, departamentos, secoes, ativo)
            VALUES (:filial_id, :departamentos, :secoes, :ativo)
            ON DUPLICATE KEY UPDATE
              departamentos = VALUES(departamentos),
              secoes = VALUES(secoes),
              ativo = VALUES(ativo)";
    $stmt = $pdo->prepare($sql);

    $salvos = 0;
    foreach ($payload['items'] as $item) {
        if (!isset($item['filial_id'])) {
            continue; // ignora itens sem filial_id
        }
        $filialId = (int) $item['filial_id'];
        $departamentosArr = isset($item['departamentos']) && is_array($item['departamentos']) ? $item['departamentos'] : [];
        $secoesArr = isset($item['secoes']) && is_array($item['secoes']) ? $item['secoes'] : [];
        $ativo = isset($item['ativo']) ? (int) (!!$item['ativo']) : 0;

        // Normalizar para CSV
        $departamentosCsv = implode(',', array_map('strval', $departamentosArr));
        $secoesCsv = implode(',', array_map('strval', $secoesArr));

        $departamentosValue = ($departamentosCsv !== '') ? $departamentosCsv : null;
        $secoesValue = ($secoesCsv !== '') ? $secoesCsv : null;

        $stmt->bindValue(':filial_id', $filialId, PDO::PARAM_INT);
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
        $salvos++;
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'message' => 'Configurações de seções por filial salvas', 'data' => ['salvos' => $salvos]]);
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao salvar configuração de seções por filial', 'error' => $e->getMessage()]);
}
?>