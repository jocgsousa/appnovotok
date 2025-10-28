<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, DELETE");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once 'database.php';
require_once 'jwt_utils.php';
require_once 'cors_config.php';

// Verificar se o método de requisição é OPTIONS e responder adequadamente
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("HTTP/1.1 200 OK");
    exit;
}

// Verificar o token JWT
$headers = getallheaders();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Token de autenticação não fornecido ou inválido"
    ]);
    exit;
}

$jwt = $matches[1];

// Validar o token JWT
$user_id = JwtUtils::validateToken($jwt);
if ($user_id === null) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Token inválido"
    ]);
    exit;
}

// Método DELETE ou POST
if ($_SERVER['REQUEST_METHOD'] === 'DELETE' || $_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Obter dados da requisição
        $data = json_decode(file_get_contents("php://input"));

        // Validar dados obrigatórios
        if (empty($data->id)) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "ID da requisição é obrigatório."
            ]);
            exit;
        }

        // Instanciar banco de dados
        $database = new Database();
        $conn = $database->getConnection();

        // Verificar se a requisição existe
        $check_query = "SELECT COUNT(*) as count FROM `request` WHERE id = :id";
        $check_stmt = $conn->prepare($check_query);
        $check_stmt->bindParam(":id", $data->id);
        $check_stmt->execute();
        $row = $check_stmt->fetch(PDO::FETCH_ASSOC);

        if ($row['count'] == 0) {
            http_response_code(404);
            echo json_encode([
                "success" => false,
                "message" => "Requisição não encontrada."
            ]);
            exit;
        }

        // Preparar a query de exclusão
        $query = "DELETE FROM `request` WHERE id = :id";
        $stmt = $conn->prepare($query);
        $stmt->bindParam(":id", $data->id);

        // Executar a exclusão
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode([
                "success" => true,
                "message" => "Requisição excluída com sucesso.",
                "id" => $data->id
            ]);
        } else {
            http_response_code(500);
            echo json_encode([
                "success" => false,
                "message" => "Erro ao excluir requisição."
            ]);
        }

    } catch (PDOException $e) {
        http_response_code(500);
        error_log('[DeleteRequest] PDOException: ' . $e->getMessage());
        echo json_encode([
            "success" => false,
            "message" => "Erro ao excluir requisição no banco de dados"
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        error_log('[DeleteRequest] Exception: ' . $e->getMessage());
        echo json_encode([
            "success" => false,
            "message" => "Erro interno do servidor"
        ]);
    }
} else {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Método não permitido. Use DELETE ou POST."
    ]);
}
?>