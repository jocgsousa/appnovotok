<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, DELETE");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once 'database.php';
include_once 'cors_config.php';
include_once 'jwt_utils.php';

// Verificar se o método de requisição é OPTIONS e responder adequadamente
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("HTTP/1.1 200 OK");
    exit;
}

// Verificar o token JWT
$token = get_bearer_token();
if (!$token || !is_jwt_valid($token)) {
    http_response_code(401);
    echo json_encode(array("success" => false, "message" => "Não autorizado"));
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
            echo json_encode(array(
                "success" => false,
                "message" => "ID da seção é obrigatório."
            ));
            exit;
        }

        // Instanciar banco de dados
        $database = new Database();
        $db = $database->getConnection();

        // Verificar se a seção existe
        $check_query = "SELECT COUNT(*) as count FROM secao WHERE id = :id";
        $check_stmt = $db->prepare($check_query);
        $check_stmt->bindParam(":id", $data->id);
        $check_stmt->execute();
        $row = $check_stmt->fetch(PDO::FETCH_ASSOC);

        if ($row['count'] == 0) {
            http_response_code(404);
            echo json_encode(array(
                "success" => false,
                "message" => "Seção não encontrada."
            ));
            exit;
        }

        // Verificar se há filtros de vendedor vinculados a esta seção
        $check_filtros_query = "SELECT COUNT(*) as count FROM vendedor_secoes WHERE secao_id = :id";
        $check_filtros_stmt = $db->prepare($check_filtros_query);
        $check_filtros_stmt->bindParam(":id", $data->id);
        $check_filtros_stmt->execute();
        $row_filtros = $check_filtros_stmt->fetch(PDO::FETCH_ASSOC);

        if ($row_filtros['count'] > 0) {
            // Excluir os filtros vinculados
            $delete_filtros_query = "DELETE FROM vendedor_secoes WHERE secao_id = :id";
            $delete_filtros_stmt = $db->prepare($delete_filtros_query);
            $delete_filtros_stmt->bindParam(":id", $data->id);
            $delete_filtros_stmt->execute();
        }

        // Preparar a query de exclusão
        $query = "DELETE FROM secao WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(":id", $data->id);

        // Executar a query
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(array(
                "success" => true,
                "message" => "Seção excluída com sucesso."
            ));
        } else {
            http_response_code(503);
            echo json_encode(array(
                "success" => false,
                "message" => "Não foi possível excluir a seção."
            ));
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array(
            "success" => false,
            "message" => "Erro ao excluir seção: " . $e->getMessage()
        ));
    }
} else {
    // Método não permitido
    http_response_code(405);
    echo json_encode(array(
        "success" => false,
        "message" => "Método não permitido"
    ));
} 