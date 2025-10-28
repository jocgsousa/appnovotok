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
                "message" => "ID do departamento é obrigatório."
            ));
            exit;
        }

        // Instanciar banco de dados
        $database = new Database();
        $db = $database->getConnection();

        // Verificar se o departamento existe
        $check_query = "SELECT COUNT(*) as count FROM departamentos WHERE id = :id";
        $check_stmt = $db->prepare($check_query);
        $check_stmt->bindParam(":id", $data->id);
        $check_stmt->execute();
        $row = $check_stmt->fetch(PDO::FETCH_ASSOC);

        if ($row['count'] == 0) {
            http_response_code(404);
            echo json_encode(array(
                "success" => false,
                "message" => "Departamento não encontrado."
            ));
            exit;
        }

        // Verificar se há seções vinculadas a este departamento
        $check_secoes_query = "SELECT COUNT(*) as count FROM secao WHERE codpto = (SELECT codpto FROM departamentos WHERE id = :id)";
        $check_secoes_stmt = $db->prepare($check_secoes_query);
        $check_secoes_stmt->bindParam(":id", $data->id);
        $check_secoes_stmt->execute();
        $row_secoes = $check_secoes_stmt->fetch(PDO::FETCH_ASSOC);

        if ($row_secoes['count'] > 0) {
            http_response_code(409);
            echo json_encode(array(
                "success" => false,
                "message" => "Não é possível excluir o departamento pois existem seções vinculadas a ele."
            ));
            exit;
        }

        // Verificar se há filtros de vendedor vinculados a este departamento
        $check_filtros_query = "SELECT COUNT(*) as count FROM vendedor_departamentos WHERE departamento_id = :id";
        $check_filtros_stmt = $db->prepare($check_filtros_query);
        $check_filtros_stmt->bindParam(":id", $data->id);
        $check_filtros_stmt->execute();
        $row_filtros = $check_filtros_stmt->fetch(PDO::FETCH_ASSOC);

        if ($row_filtros['count'] > 0) {
            // Excluir os filtros vinculados
            $delete_filtros_query = "DELETE FROM vendedor_departamentos WHERE departamento_id = :id";
            $delete_filtros_stmt = $db->prepare($delete_filtros_query);
            $delete_filtros_stmt->bindParam(":id", $data->id);
            $delete_filtros_stmt->execute();
        }

        // Preparar a query de exclusão
        $query = "DELETE FROM departamentos WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(":id", $data->id);

        // Executar a query
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(array(
                "success" => true,
                "message" => "Departamento excluído com sucesso."
            ));
        } else {
            http_response_code(503);
            echo json_encode(array(
                "success" => false,
                "message" => "Não foi possível excluir o departamento."
            ));
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array(
            "success" => false,
            "message" => "Erro ao excluir departamento: " . $e->getMessage()
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