<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
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

try {
    // Obter o ID do usuário a partir do token
    $user_id = JwtUtils::validateToken($bearer_token);
    
    // Conectar ao banco de dados
    $database = new Database();
    $db = $database->getConnection();
    
    // Consultar os dados do usuário
    $query = "SELECT id, nome, email, cpf, telefone, tipo_usuario, ativo, created_at, updated_at 
              FROM usuarios 
              WHERE id = :id";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':id', $user_id);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Montar o objeto de resposta
        $usuario = array(
            "id" => $row['id'],
            "nome" => $row['nome'],
            "email" => $row['email'],
            "cpf" => $row['cpf'],
            "telefone" => $row['telefone'],
            "tipo_usuario" => $row['tipo_usuario'],
            "ativo" => (bool)$row['ativo'],
            "created_at" => $row['created_at'],
            "updated_at" => $row['updated_at']
        );
        
        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => "Dados do usuário obtidos com sucesso",
            "usuario" => $usuario
        ));
    } else {
        http_response_code(404);
        echo json_encode(array("success" => false, "message" => "Usuário não encontrado"));
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "Erro ao obter dados do usuário",
        "error" => $e->getMessage()
    ));
}
?> 