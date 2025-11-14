<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once 'database.php';
include_once 'jwt_utils.php';
include_once 'cors_config.php';

// Responder pré-flight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Validar token JWT
$bearer_token = get_bearer_token();
if (!$bearer_token) {
    http_response_code(401);
    echo json_encode(array("success" => false, "message" => "Token de acesso não fornecido"));
    exit;
}

try {
    $user_id = JwtUtils::validateToken($bearer_token);
    if (!$user_id) {
        http_response_code(401);
        echo json_encode(array("success" => false, "message" => "Token de acesso inválido ou expirado"));
        exit;
    }

    // Ler payload
    $data = json_decode(file_get_contents("php://input"));
    if (!isset($data->usuario_id)) {
        http_response_code(400);
        echo json_encode(array("success" => false, "message" => "Parâmetro 'usuario_id' é obrigatório"));
        exit;
    }

    $usuario_alvo_id = intval($data->usuario_id);

    // Conectar DB
    $database = new Database();
    $db = $database->getConnection();

    // Obter usuário solicitante e verificar permissões (somente admin pode consolidar)
    $stmt_solicitante = $db->prepare("SELECT id, tipo_usuario, ativo FROM usuarios WHERE id = :id");
    $stmt_solicitante->bindParam(':id', $user_id);
    $stmt_solicitante->execute();
    if ($stmt_solicitante->rowCount() === 0) {
        http_response_code(401);
        echo json_encode(array("success" => false, "message" => "Usuário solicitante não encontrado"));
        exit;
    }
    $solicitante = $stmt_solicitante->fetch(PDO::FETCH_ASSOC);
    if (!$solicitante['ativo']) {
        http_response_code(403);
        echo json_encode(array("success" => false, "message" => "Usuário solicitante inativo"));
        exit;
    }
    if ($solicitante['tipo_usuario'] !== 'admin') {
        http_response_code(403);
        echo json_encode(array("success" => false, "message" => "Apenas administradores podem consolidar permissões"));
        exit;
    }

    // Verificar usuário alvo
    $stmt_alvo = $db->prepare("SELECT id FROM usuarios WHERE id = :id");
    $stmt_alvo->bindParam(':id', $usuario_alvo_id);
    $stmt_alvo->execute();
    if ($stmt_alvo->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array("success" => false, "message" => "Usuário alvo não encontrado"));
        exit;
    }

    // Inserir permissões faltantes para todos os menus ativos
    $sql_insert = "INSERT INTO permissoes_usuarios (usuario_id, menu_id, visualizar, criar, editar, excluir)
                   SELECT :usuario_id1, m.id, 0, 0, 0, 0
                   FROM menus m
                   WHERE m.ativo = 1
                     AND NOT EXISTS (
                       SELECT 1 FROM permissoes_usuarios p
                       WHERE p.usuario_id = :usuario_id2 AND p.menu_id = m.id
                   )";

    $stmt_insert = $db->prepare($sql_insert);
    $stmt_insert->bindParam(':usuario_id1', $usuario_alvo_id, PDO::PARAM_INT);
    $stmt_insert->bindParam(':usuario_id2', $usuario_alvo_id, PDO::PARAM_INT);
    $stmt_insert->execute();

    // Tentar obter número de registros inseridos
    $inseridos = $stmt_insert->rowCount();

    http_response_code(200);
    echo json_encode(array(
        "success" => true,
        "message" => $inseridos > 0 ? "Permissões consolidadas com sucesso" : "Nenhuma permissão faltante encontrada",
        "inseridos" => $inseridos
    ));
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "Erro ao consolidar permissões do usuário",
        "error" => $e->getMessage()
    ));
}
?>