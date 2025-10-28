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
            empty($data->rid) ||
            !isset($data->codsec) ||
            empty($data->descricao)
        ) {
            http_response_code(400);
            echo json_encode(array(
                "success" => false,
                "message" => "Dados incompletos. RID, código da seção e descrição são obrigatórios."
            ));
            exit;
        }

        // Instanciar banco de dados
        $database = new Database();
        $db = $database->getConnection();

        // Se o departamento foi informado, verificar se ele existe
        if (!empty($data->codpto)) {
            $check_depto_query = "SELECT COUNT(*) as count FROM departamentos WHERE codpto = :codpto";
            $check_depto_stmt = $db->prepare($check_depto_query);
            $check_depto_stmt->bindParam(":codpto", $data->codpto);
            $check_depto_stmt->execute();
            $row_depto = $check_depto_stmt->fetch(PDO::FETCH_ASSOC);

            if ($row_depto['count'] == 0) {
                // Departamento não existe, mas vamos continuar e cadastrar a seção sem departamento
                // Apenas registramos no log
                error_log("Aviso: Tentativa de cadastrar seção com departamento inexistente (codpto: {$data->codpto})");
                
                // Definimos codpto como 0 para indicar que não tem departamento associado
                $data->codpto = 0;
            }
        } else {
            // Se não foi informado departamento, definimos como 0
            $data->codpto = 0;
        }

        // Verificar se a seção já existe pelo código da seção (codsec), independente do departamento
        $check_query = "SELECT COUNT(*) as count FROM secao WHERE codsec = :codsec";
        $check_stmt = $db->prepare($check_query);
        $check_stmt->bindParam(":codsec", $data->codsec);
        $check_stmt->execute();
        $row = $check_stmt->fetch(PDO::FETCH_ASSOC);

        if ($row['count'] > 0) {
            http_response_code(409);
            echo json_encode(array(
                "success" => false,
                "message" => "Seção com este código já existe no sistema."
            ));
            exit;
        }

        // Preparar a query de inserção
        $query = "INSERT INTO secao (rid, codpto, codsec, descricao, linha, qtmax, tipo) 
                  VALUES (:rid, :codpto, :codsec, :descricao, :linha, :qtmax, :tipo)";

        $stmt = $db->prepare($query);

        // Limpar e sanitizar dados
        $rid = htmlspecialchars(strip_tags($data->rid));
        $codpto = htmlspecialchars(strip_tags($data->codpto));
        $codsec = htmlspecialchars(strip_tags($data->codsec));
        $descricao = htmlspecialchars(strip_tags($data->descricao));
        $linha = isset($data->linha) ? htmlspecialchars(strip_tags($data->linha)) : '';
        $qtmax = isset($data->qtmax) ? htmlspecialchars(strip_tags($data->qtmax)) : null;
        $tipo = isset($data->tipo) ? htmlspecialchars(strip_tags($data->tipo)) : '';

        // Vincular parâmetros
        $stmt->bindParam(":rid", $rid);
        $stmt->bindParam(":codpto", $codpto);
        $stmt->bindParam(":codsec", $codsec);
        $stmt->bindParam(":descricao", $descricao);
        $stmt->bindParam(":linha", $linha);
        $stmt->bindParam(":qtmax", $qtmax);
        $stmt->bindParam(":tipo", $tipo);

        // Executar a query
        if ($stmt->execute()) {
            $id = $db->lastInsertId();
            
            http_response_code(201);
            echo json_encode(array(
                "success" => true,
                "message" => "Seção cadastrada com sucesso.",
                "id" => $id
            ));
        } else {
            http_response_code(503);
            echo json_encode(array(
                "success" => false,
                "message" => "Não foi possível cadastrar a seção."
            ));
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array(
            "success" => false,
            "message" => "Erro ao cadastrar seção: " . $e->getMessage()
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