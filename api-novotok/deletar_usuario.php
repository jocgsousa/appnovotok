<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: DELETE, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once 'database.php';
include_once 'jwt_utils.php';
include_once 'cors_config.php';

// Verificar se a requisição é OPTIONS e retornar apenas os cabeçalhos
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Verificar se o token JWT está presente e é válido
$bearer_token = get_bearer_token();
if (!$bearer_token || !is_jwt_valid($bearer_token)) {
    http_response_code(401);
    echo json_encode(array("success" => false, "message" => "Acesso não autorizado"));
    exit;
}

// Obter dados da requisição
$data = json_decode(file_get_contents("php://input"));

// Verificar se o ID do usuário foi fornecido
if (!isset($data->id)) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "ID do usuário não fornecido"));
    exit;
}

$usuario_id = intval($data->id);

// Verificar se o usuário está tentando excluir o próprio ID
$user_id = JwtUtils::validateToken($bearer_token);
if ($user_id == $usuario_id) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Não é possível excluir o próprio usuário"));
    exit;
}

try {
    // Conectar ao banco de dados
    $database = new Database();
    $db = $database->getConnection();
    
    // Verificar se o usuário existe
    $check_usuario = "SELECT id FROM usuarios WHERE id = :id";
    $stmt_check = $db->prepare($check_usuario);
    $stmt_check->bindParam(':id', $usuario_id);
    $stmt_check->execute();
    
    if ($stmt_check->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array("success" => false, "message" => "Usuário não encontrado"));
        exit;
    }
    
    // Verificar se é o usuário admin (ID 1)
    if ($usuario_id === 1) {
        http_response_code(400);
        echo json_encode(array("success" => false, "message" => "Não é possível excluir o usuário administrador"));
        exit;
    }
    
    // Iniciar uma transação
    $db->beginTransaction();
    
    try {
        // Excluir as permissões do usuário
        $sql_permissoes = "DELETE FROM permissoes_usuarios WHERE usuario_id = :usuario_id";
        $stmt_permissoes = $db->prepare($sql_permissoes);
        $stmt_permissoes->bindParam(':usuario_id', $usuario_id);
        $stmt_permissoes->execute();
        
        // Excluir o usuário
        $sql_usuario = "DELETE FROM usuarios WHERE id = :id";
        $stmt_usuario = $db->prepare($sql_usuario);
        $stmt_usuario->bindParam(':id', $usuario_id);
        
        if ($stmt_usuario->execute()) {
            // Confirmar a transação
            $db->commit();
            
            http_response_code(200);
            echo json_encode(array(
                "success" => true,
                "message" => "Usuário excluído com sucesso"
            ));
        } else {
            // Reverter a transação
            $db->rollBack();
            
            http_response_code(500);
            echo json_encode(array("success" => false, "message" => "Erro ao excluir usuário"));
        }
    } catch (Exception $e) {
        // Reverter a transação em caso de erro
        $db->rollBack();
        throw $e;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "Erro ao excluir usuário",
        "error" => $e->getMessage()
    ));
}
?> 