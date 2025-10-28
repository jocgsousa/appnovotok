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
            !isset($data->codpto) ||
            empty($data->descricao)
        ) {
            http_response_code(400);
            echo json_encode(array(
                "success" => false,
                "message" => "Dados incompletos. RID, código do departamento e descrição são obrigatórios."
            ));
            exit;
        }

        // Instanciar banco de dados
        $database = new Database();
        $db = $database->getConnection();

        // Verificar se o departamento já existe
        $check_query = "SELECT COUNT(*) as count FROM departamentos WHERE codpto = :codpto";
        $check_stmt = $db->prepare($check_query);
        $check_stmt->bindParam(":codpto", $data->codpto);
        $check_stmt->execute();
        $row = $check_stmt->fetch(PDO::FETCH_ASSOC);

        if ($row['count'] > 0) {
            http_response_code(409);
            echo json_encode(array(
                "success" => false,
                "message" => "Departamento com este código já existe."
            ));
            exit;
        }

        // Preparar a query de inserção
        $query = "INSERT INTO departamentos (rid, atualizainvgeral, codpto, descricao, margemprevista, referencia, tipomerc) 
                  VALUES (:rid, :atualizainvgeral, :codpto, :descricao, :margemprevista, :referencia, :tipomerc)";

        $stmt = $db->prepare($query);

        // Limpar e sanitizar dados
        $rid = htmlspecialchars(strip_tags($data->rid));
        $atualizainvgeral = isset($data->atualizainvgeral) ? htmlspecialchars(strip_tags($data->atualizainvgeral)) : 'N';
        $codpto = htmlspecialchars(strip_tags($data->codpto));
        $descricao = htmlspecialchars(strip_tags($data->descricao));
        $margemprevista = isset($data->margemprevista) ? htmlspecialchars(strip_tags($data->margemprevista)) : 0;
        $referencia = isset($data->referencia) ? htmlspecialchars(strip_tags($data->referencia)) : '';
        $tipomerc = isset($data->tipomerc) ? htmlspecialchars(strip_tags($data->tipomerc)) : '';

        // Vincular parâmetros
        $stmt->bindParam(":rid", $rid);
        $stmt->bindParam(":atualizainvgeral", $atualizainvgeral);
        $stmt->bindParam(":codpto", $codpto);
        $stmt->bindParam(":descricao", $descricao);
        $stmt->bindParam(":margemprevista", $margemprevista);
        $stmt->bindParam(":referencia", $referencia);
        $stmt->bindParam(":tipomerc", $tipomerc);

        // Executar a query
        if ($stmt->execute()) {
            $id = $db->lastInsertId();
            
            http_response_code(201);
            echo json_encode(array(
                "success" => true,
                "message" => "Departamento cadastrado com sucesso.",
                "id" => $id
            ));
        } else {
            http_response_code(503);
            echo json_encode(array(
                "success" => false,
                "message" => "Não foi possível cadastrar o departamento."
            ));
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array(
            "success" => false,
            "message" => "Erro ao cadastrar departamento: " . $e->getMessage()
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