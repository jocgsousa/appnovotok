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
    $usuario_id = $payload->data->user_id;
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token inválido: " . $e->getMessage()
    ]);
    exit;
}

// Obter o ID do grupo da URL
$grupo_id = isset($_GET['id']) ? trim($_GET['id']) : '';

if (empty($grupo_id)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "ID do grupo é obrigatório."
    ]);
    exit;
}

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

try {
    // Verificar se o grupo existe
    $sqlCheck = "SELECT id, nome FROM grupos_metas_produtos WHERE id = ?";
    $stmtCheck = $conn->prepare($sqlCheck);
    $stmtCheck->bindValue(1, $grupo_id);
    $stmtCheck->execute();

    if ($stmtCheck->rowCount() === 0) {
        http_response_code(404);
        echo json_encode([
            "status" => 0,
            "message" => "Grupo não encontrado."
        ]);
        exit;
    }

    $grupo = $stmtCheck->fetch(PDO::FETCH_ASSOC);

    // Verificar quantas metas serão deletadas junto com o grupo (para informar no retorno)
    $sqlCheckUso = "SELECT COUNT(*) as total FROM metas_produtos_grupo WHERE grupo_id = ?";
    $stmtCheckUso = $conn->prepare($sqlCheckUso);
    $stmtCheckUso->bindValue(1, $grupo_id);
    $stmtCheckUso->execute();
    $usoResult = $stmtCheckUso->fetch(PDO::FETCH_ASSOC);
    $metasAssociadas = $usoResult['total'];

    // Iniciar transação
    $conn->beginTransaction();

    // Deletar todas as metas do grupo primeiro (devido à foreign key)
    $sqlDeleteMetas = "DELETE FROM metas_produtos_grupo WHERE grupo_id = ?";
    $stmtDeleteMetas = $conn->prepare($sqlDeleteMetas);
    $stmtDeleteMetas->bindValue(1, $grupo_id);
    $stmtDeleteMetas->execute();

    // Deletar o grupo
    $sqlDeleteGrupo = "DELETE FROM grupos_metas_produtos WHERE id = ?";
    $stmtDeleteGrupo = $conn->prepare($sqlDeleteGrupo);
    $stmtDeleteGrupo->bindValue(1, $grupo_id);
    $stmtDeleteGrupo->execute();

    // Confirmar transação
    $conn->commit();

    http_response_code(200);
    $mensagem = "Grupo de metas '" . $grupo['nome'] . "' excluído com sucesso";
    if ($metasAssociadas > 0) {
        $mensagem .= " (incluindo " . $metasAssociadas . " meta(s) de produto(s) associada(s))";
    }
    echo json_encode([
        "status" => 1,
        "message" => $mensagem
    ]);

} catch (Exception $e) {
    // Reverter transação em caso de erro (apenas se estiver ativa)
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        "status" => 0,
        "message" => "Erro interno do servidor: " . $e->getMessage()
    ]);
}
?>