<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
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

// Método POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Obter dados da requisição
        $data = json_decode(file_get_contents("php://input"));

        // Validar dados obrigatórios
        if (
            !isset($data->vendedor_id) || 
            empty($data->vendedor_id) || 
            !isset($data->departamentos) || 
            !isset($data->secoes)
        ) {
            http_response_code(400);
            echo json_encode(array(
                "success" => false,
                "message" => "Dados incompletos. ID do vendedor, departamentos e seções são obrigatórios."
            ));
            exit;
        }

        $vendedor_id = intval($data->vendedor_id);
        $departamentos = $data->departamentos;
        $secoes = $data->secoes;

        // Instanciar banco de dados
        $database = new Database();
        $db = $database->getConnection();

        // Verificar se o vendedor existe
        $check_query = "SELECT COUNT(*) as count FROM vendedores WHERE id = :id";
        $check_stmt = $db->prepare($check_query);
        $check_stmt->bindParam(":id", $vendedor_id);
        $check_stmt->execute();
        $row = $check_stmt->fetch(PDO::FETCH_ASSOC);

        if ($row['count'] == 0) {
            http_response_code(404);
            echo json_encode(array(
                "success" => false,
                "message" => "Vendedor não encontrado"
            ));
            exit;
        }

        // Iniciar transação
        $db->beginTransaction();

        try {
            // Remover filtros de departamentos existentes
            $delete_departamentos = "DELETE FROM vendedor_departamentos WHERE vendedor_id = :vendedor_id";
            $stmt_delete_departamentos = $db->prepare($delete_departamentos);
            $stmt_delete_departamentos->bindParam(":vendedor_id", $vendedor_id);
            $stmt_delete_departamentos->execute();

            // Remover filtros de seções existentes
            $delete_secoes = "DELETE FROM vendedor_secoes WHERE vendedor_id = :vendedor_id";
            $stmt_delete_secoes = $db->prepare($delete_secoes);
            $stmt_delete_secoes->bindParam(":vendedor_id", $vendedor_id);
            $stmt_delete_secoes->execute();

            // Inserir novos filtros de departamentos
            if (!empty($departamentos)) {
                $insert_departamento = "INSERT INTO vendedor_departamentos (vendedor_id, departamento_id) VALUES (:vendedor_id, :departamento_id)";
                $stmt_insert_departamento = $db->prepare($insert_departamento);
                
                foreach ($departamentos as $departamento_id) {
                    // Verificar se o departamento existe
                    $check_dept_query = "SELECT id FROM departamentos WHERE codpto = :codpto";
                    $check_dept_stmt = $db->prepare($check_dept_query);
                    $check_dept_stmt->bindParam(":codpto", $departamento_id);
                    $check_dept_stmt->execute();
                    $dept_row = $check_dept_stmt->fetch(PDO::FETCH_ASSOC);
                    
                    if ($dept_row) {
                        $stmt_insert_departamento->bindParam(":vendedor_id", $vendedor_id);
                        $stmt_insert_departamento->bindParam(":departamento_id", $dept_row['id']);
                        $stmt_insert_departamento->execute();
                    }
                }
            }

            // Inserir novos filtros de seções
            if (!empty($secoes)) {
                $insert_secao = "INSERT INTO vendedor_secoes (vendedor_id, secao_id) VALUES (:vendedor_id, :secao_id)";
                $stmt_insert_secao = $db->prepare($insert_secao);
                
                foreach ($secoes as $secao_id) {
                    // Verificar se a seção existe
                    $check_secao_query = "SELECT id FROM secao WHERE codsec = :codsec";
                    $check_secao_stmt = $db->prepare($check_secao_query);
                    $check_secao_stmt->bindParam(":codsec", $secao_id);
                    $check_secao_stmt->execute();
                    $secao_row = $check_secao_stmt->fetch(PDO::FETCH_ASSOC);
                    
                    if ($secao_row) {
                        $stmt_insert_secao->bindParam(":vendedor_id", $vendedor_id);
                        $stmt_insert_secao->bindParam(":secao_id", $secao_row['id']);
                        $stmt_insert_secao->execute();
                    }
                }
            }

            // Confirmar transação
            $db->commit();

            http_response_code(200);
            echo json_encode(array(
                "success" => true,
                "message" => "Filtros salvos com sucesso",
                "vendedor_id" => $vendedor_id,
                "departamentos_count" => count($departamentos),
                "secoes_count" => count($secoes)
            ));
        } catch (PDOException $e) {
            // Reverter transação em caso de erro
            $db->rollBack();
            throw $e;
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array(
            "success" => false,
            "message" => "Erro ao salvar filtros do vendedor: " . $e->getMessage()
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