<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: access");
header("Access-Control-Allow-Methods: DELETE");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require 'database.php';
require 'jwt_utils.php';
require 'cors_config.php';

// Verificar se o método da requisição é DELETE
if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode([
        "status" => 0,
        "message" => "Método não permitido. Apenas DELETE é aceito."
    ]);
    exit;
}

// Obter o conteúdo do corpo da requisição
$data = json_decode(file_get_contents("php://input"));

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
    $usuario_id = $payload->data->user_id; // ID do usuário que está excluindo a meta
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token inválido: " . $e->getMessage()
    ]);
    exit;
}

// Verificar se o ID da meta e o tipo de meta foram fornecidos
if (!isset($data->id) || !isset($data->tipo_meta)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "ID da meta e tipo de meta não fornecidos."
    ]);
    exit;
}

$meta_id = intval($data->id);
$tipo_meta = $data->tipo_meta; // 'vendas' ou 'cadastro_clientes'

// Validar o tipo de meta
if ($tipo_meta !== 'vendas' && $tipo_meta !== 'cadastro_clientes') {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Tipo de meta inválido. Use 'vendas' ou 'cadastro_clientes'."
    ]);
    exit;
}

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

// Verificar se a meta existe na tabela correta
$tabela = $tipo_meta === 'vendas' ? 'metas_vendas' : 'metas_cadastro_clientes';

$stmt = $conn->prepare("SELECT * FROM {$tabela} WHERE id = ?");
$stmt->bindParam(1, $meta_id, PDO::PARAM_INT);
$stmt->execute();

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode([
        "status" => 0,
        "message" => "Meta não encontrada."
    ]);
    exit;
}

$meta = $stmt->fetch(PDO::FETCH_ASSOC);

// Registrar no histórico antes de excluir
if ($tipo_meta === 'vendas') {
    $stmt = $conn->prepare("INSERT INTO historico_atualizacao_metas 
                           (tipo_meta, meta_id, vendedor_id, mes, ano, valor_anterior, observacoes, usuario) 
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bindParam(1, $tipo_meta, PDO::PARAM_STR);
    $stmt->bindParam(2, $meta_id, PDO::PARAM_INT);
    $stmt->bindParam(3, $meta['vendedor_id'], PDO::PARAM_INT);
    $stmt->bindParam(4, $meta['mes'], PDO::PARAM_INT);
    $stmt->bindParam(5, $meta['ano'], PDO::PARAM_INT);
    $stmt->bindParam(6, $meta['valor_meta'], PDO::PARAM_STR);
    $observacao = "Meta excluída";
    $stmt->bindParam(7, $observacao, PDO::PARAM_STR);
    $usuario_nome = isset($payload->usuario) ? $payload->usuario : "Sistema";
    $stmt->bindParam(8, $usuario_nome, PDO::PARAM_STR);
} else {
    $stmt = $conn->prepare("INSERT INTO historico_atualizacao_metas 
                           (tipo_meta, meta_id, vendedor_id, mes, ano, quantidade_anterior, observacoes, usuario) 
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bindParam(1, $tipo_meta, PDO::PARAM_STR);
    $stmt->bindParam(2, $meta_id, PDO::PARAM_INT);
    $stmt->bindParam(3, $meta['vendedor_id'], PDO::PARAM_INT);
    $stmt->bindParam(4, $meta['mes'], PDO::PARAM_INT);
    $stmt->bindParam(5, $meta['ano'], PDO::PARAM_INT);
    $stmt->bindParam(6, $meta['quantidade_meta'], PDO::PARAM_INT);
    $observacao = "Meta excluída";
    $stmt->bindParam(7, $observacao, PDO::PARAM_STR);
    $usuario_nome = isset($payload->usuario) ? $payload->usuario : "Sistema";
    $stmt->bindParam(8, $usuario_nome, PDO::PARAM_STR);
}
$stmt->execute();

// Excluir a meta
$stmt = $conn->prepare("DELETE FROM {$tabela} WHERE id = ?");
$stmt->bindParam(1, $meta_id, PDO::PARAM_INT);

if ($stmt->execute()) {
    http_response_code(200);
    echo json_encode([
        "status" => 1,
        "message" => "Meta excluída com sucesso"
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        "status" => 0,
        "message" => "Erro ao excluir meta."
    ]);
}
?>