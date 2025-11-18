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

$vendedorId = isset($_GET['vendedor_id']) ? intval($_GET['vendedor_id']) : 0;
if ($vendedorId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Parâmetro vendedor_id é obrigatório']);
    exit();
}

try {
    $db = new Database();
    $pdo = $db->getConnection();

    // Garantir tabela
    $pdo->exec("CREATE TABLE IF NOT EXISTS bijou_vendedor_secoes_config (
      vendedor_id INT NOT NULL PRIMARY KEY,
      departamentos VARCHAR(1000) DEFAULT NULL,
      secoes VARCHAR(2000) DEFAULT NULL,
      ativo TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $stmt = $pdo->prepare("SELECT vendedor_id, departamentos, secoes, ativo FROM bijou_vendedor_secoes_config WHERE vendedor_id = :vendedor_id LIMIT 1");
    $stmt->bindValue(':vendedor_id', $vendedorId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        echo json_encode([
            'success' => true,
            'vendedor_id' => $vendedorId,
            'ativo' => 0,
            'departamentos' => [],
            'secoes' => [],
            'message' => 'Sem configuração cadastrada para este vendedor'
        ]);
        exit();
    }

    $departamentos = [];
    $secoes = [];

    if (!empty($row['departamentos'])) {
        $parts = array_filter(array_map('trim', explode(',', $row['departamentos'])));
        foreach ($parts as $p) {
            if ($p !== '') {
                $departamentos[] = ['codpto' => intval($p)];
            }
        }
    }

    if (!empty($row['secoes'])) {
        $parts = array_filter(array_map('trim', explode(',', $row['secoes'])));
        foreach ($parts as $p) {
            if ($p !== '') {
                $secoes[] = ['codsec' => intval($p)];
            }
        }
    }

    echo json_encode([
        'success' => true,
        'vendedor_id' => intval($row['vendedor_id']),
        'ativo' => intval($row['ativo']),
        'departamentos' => $departamentos,
        'secoes' => $secoes
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao listar configuração de seções por vendedor', 'error' => $e->getMessage()]);
}
?>