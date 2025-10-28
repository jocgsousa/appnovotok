<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: access");
header("Access-Control-Allow-Methods: GET");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require 'database.php';
require 'jwt_utils.php';
require 'cors_config.php';

// Verificar se o método da requisição é GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "status" => 0,
        "message" => "Método não permitido. Apenas GET é aceito."
    ]);
    exit;
}

// Verificar se o token JWT foi fornecido
$headers = getallheaders();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token de autenticação não fornecido ou inválido"
    ]);
    exit;
}

$jwt = $matches[1];

// Validar o token JWT
try {
    $payload = decodeJWT($jwt);
    $usuario_id = $payload->id;
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token inválido: " . $e->getMessage()
    ]);
    exit;
}

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

try {
    // Parâmetros de filtro opcionais
    $filial_id = isset($_GET['filial_id']) ? trim($_GET['filial_id']) : '';
    $periodo = isset($_GET['periodo']) ? trim($_GET['periodo']) : '';
    $status = isset($_GET['status']) ? $_GET['status'] : '';
    $busca = isset($_GET['busca']) ? trim($_GET['busca']) : '';

    // Construir a consulta SQL base
    $sql = "SELECT 
                ml.id,
                ml.filial_id,
                ml.filial_nome,
                ml.periodo,
                ml.data_inicio,
                ml.data_fim,
                ml.valor_venda_loja_total,
                ml.data_criacao,
                ml.status,
                ml.created_at,
                ml.updated_at
            FROM metas_lojas ml
            WHERE 1=1";

    $params = [];
    $paramIndex = 1;

    // Aplicar filtros
    if (!empty($filial_id)) {
        $sql .= " AND ml.filial_id = ?";
        $params[$paramIndex++] = $filial_id;
    }

    if (!empty($periodo)) {
        $sql .= " AND ml.periodo LIKE ?";
        $params[$paramIndex++] = '%' . $periodo . '%';
    }

    if ($status !== '') {
        $sql .= " AND ml.status = ?";
        $params[$paramIndex++] = $status;
    }

    if (!empty($busca)) {
        $sql .= " AND (ml.filial_nome LIKE ? OR ml.periodo LIKE ?)";
        $buscaParam = '%' . $busca . '%';
        $params[$paramIndex++] = $buscaParam;
        $params[$paramIndex++] = $buscaParam;
    }

    $sql .= " ORDER BY ml.created_at DESC, ml.filial_nome ASC";

    $stmt = $conn->prepare($sql);

    // Bind dos parâmetros
    foreach ($params as $index => $value) {
        $stmt->bindValue($index, $value);
    }

    $stmt->execute();
    $metas = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Formatar os resultados
    $metasFormatadas = [];
    foreach ($metas as $meta) {
        $metasFormatadas[] = [
            'id' => $meta['id'],
            'filialId' => (int)$meta['filial_id'],
            'filialNome' => $meta['filial_nome'],
            'periodo' => $meta['periodo'],
            'dataInicio' => $meta['data_inicio'],
            'dataFim' => $meta['data_fim'],
            'valorVendaLojaTotal' => (float)$meta['valor_venda_loja_total'],
            'dataCriacao' => $meta['data_criacao'],
            'status' => $meta['status'],
            'createdAt' => $meta['created_at'],
            'updatedAt' => $meta['updated_at']
        ];
    }

    http_response_code(200);
    echo json_encode([
        "status" => 1,
        "message" => "Metas de lojas listadas com sucesso",
        "data" => $metasFormatadas,
        "total" => count($metasFormatadas)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => 0,
        "message" => "Erro interno do servidor: " . $e->getMessage()
    ]);
}
?>