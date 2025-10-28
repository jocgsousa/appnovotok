<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
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

// Método GET
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Instanciar banco de dados
        $database = new Database();
        $db = $database->getConnection();

        // Preparar a consulta SQL base
        $query = "SELECT * FROM departamentos WHERE 1=1";
        $params = array();

        // Filtrar por ID se fornecido
        if (isset($_GET['id']) && !empty($_GET['id'])) {
            $query .= " AND id = :id";
            $params[':id'] = $_GET['id'];
        }

        // Filtrar por código de departamento se fornecido
        if (isset($_GET['codpto']) && !empty($_GET['codpto'])) {
            $query .= " AND codpto = :codpto";
            $params[':codpto'] = $_GET['codpto'];
        }

        // Filtrar por descrição se fornecido
        if (isset($_GET['descricao']) && !empty($_GET['descricao'])) {
            $query .= " AND descricao LIKE :descricao";
            $params[':descricao'] = '%' . $_GET['descricao'] . '%';
        }

        // Ordenação
        $query .= " ORDER BY codpto ASC";

        // Preparar e executar a consulta
        $stmt = $db->prepare($query);
        foreach ($params as $param => $value) {
            $stmt->bindValue($param, $value);
        }
        $stmt->execute();

        // Verificar se há resultados
        if ($stmt->rowCount() > 0) {
            $departamentos = array();

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $departamento = array(
                    "id" => $row['id'],
                    "rid" => $row['rid'],
                    "atualizainvgeral" => $row['atualizainvgeral'],
                    "codpto" => $row['codpto'],
                    "descricao" => $row['descricao'],
                    "margemprevista" => $row['margemprevista'],
                    "referencia" => $row['referencia'],
                    "tipomerc" => $row['tipomerc'],
                    "created_at" => $row['created_at'],
                    "updated_at" => $row['updated_at']
                );
                array_push($departamentos, $departamento);
            }

            // Resposta de sucesso
            http_response_code(200);
            echo json_encode(array(
                "success" => true,
                "departamentos" => $departamentos
            ));
        } else {
            // Nenhum departamento encontrado
            http_response_code(200);
            echo json_encode(array(
                "success" => true,
                "departamentos" => array()
            ));
        }
    } catch (PDOException $e) {
        // Erro de banco de dados
        http_response_code(500);
        echo json_encode(array(
            "success" => false,
            "message" => "Erro ao listar departamentos: " . $e->getMessage()
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