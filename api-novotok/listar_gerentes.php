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
    $ativo = isset($_GET['ativo']) ? $_GET['ativo'] : '';
    $busca = isset($_GET['busca']) ? trim($_GET['busca']) : '';

    // Construir a consulta SQL base
    $sql = "SELECT id, nome, email, telefone, data_criacao, ativo FROM gerentes WHERE 1=1";

    $params = [];
    $paramIndex = 1;

    // Aplicar filtros
    if ($ativo !== '') {
        $sql .= " AND ativo = ?";
        $params[$paramIndex++] = $ativo === 'true' ? 1 : 0;
    }

    if (!empty($busca)) {
        $sql .= " AND (nome LIKE ? OR email LIKE ?)";
        $buscaParam = '%' . $busca . '%';
        $params[$paramIndex++] = $buscaParam;
        $params[$paramIndex++] = $buscaParam;
    }

    $sql .= " ORDER BY nome ASC";

    $stmt = $conn->prepare($sql);

    // Bind dos parâmetros
    foreach ($params as $index => $value) {
        $stmt->bindValue($index, $value);
    }

    $stmt->execute();
    $gerentes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Formatar os resultados
    $gerentesFormatados = [];
    foreach ($gerentes as $gerente) {
        $gerentesFormatados[] = [
            'id' => $gerente['id'],
            'nome' => $gerente['nome'],
            'email' => $gerente['email'],
            'telefone' => $gerente['telefone'],
            'dataCriacao' => $gerente['data_criacao'],
            'ativo' => (bool)$gerente['ativo']
        ];
    }

    http_response_code(200);
    echo json_encode([
        "status" => 1,
        "message" => "Gerentes listados com sucesso",
        "data" => $gerentesFormatados,
        "total" => count($gerentesFormatados)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => 0,
        "message" => "Erro interno do servidor: " . $e->getMessage()
    ]);
}
?>