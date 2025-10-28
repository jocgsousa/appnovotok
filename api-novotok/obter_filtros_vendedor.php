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
        // Validar parâmetros
        if (!isset($_GET['vendedor_id']) || empty($_GET['vendedor_id'])) {
            http_response_code(400);
            echo json_encode(array(
                "success" => false,
                "message" => "ID do vendedor é obrigatório"
            ));
            exit;
        }

        $vendedor_id = intval($_GET['vendedor_id']);

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

        // Obter departamentos configurados para o vendedor
        $query_departamentos = "
            SELECT vd.departamento_id, d.* 
            FROM vendedor_departamentos vd
            JOIN departamentos d ON vd.departamento_id = d.id
            WHERE vd.vendedor_id = :vendedor_id
            ORDER BY d.codpto ASC";
        
        $stmt_departamentos = $db->prepare($query_departamentos);
        $stmt_departamentos->bindParam(":vendedor_id", $vendedor_id);
        $stmt_departamentos->execute();
        
        $departamentos = array();
        while ($row = $stmt_departamentos->fetch(PDO::FETCH_ASSOC)) {
            $departamento = array(
                "id" => $row['id'],
                "rid" => $row['rid'],
                "atualizainvgeral" => $row['atualizainvgeral'],
                "codpto" => $row['codpto'],
                "descricao" => $row['descricao'],
                "margemprevista" => $row['margemprevista'],
                "referencia" => $row['referencia'],
                "tipomerc" => $row['tipomerc']
            );
            array_push($departamentos, $departamento);
        }

        // Obter seções configuradas para o vendedor
        $query_secoes = "
            SELECT vs.secao_id, s.*, d.descricao as departamento_descricao 
            FROM vendedor_secoes vs
            JOIN secao s ON vs.secao_id = s.id
            JOIN departamentos d ON s.codpto = d.codpto
            WHERE vs.vendedor_id = :vendedor_id
            ORDER BY s.codpto ASC, s.codsec ASC";
        
        $stmt_secoes = $db->prepare($query_secoes);
        $stmt_secoes->bindParam(":vendedor_id", $vendedor_id);
        $stmt_secoes->execute();
        
        $secoes = array();
        while ($row = $stmt_secoes->fetch(PDO::FETCH_ASSOC)) {
            $secao = array(
                "id" => $row['id'],
                "rid" => $row['rid'],
                "codpto" => $row['codpto'],
                "codsec" => $row['codsec'],
                "descricao" => $row['descricao'],
                "linha" => $row['linha'],
                "qtmax" => $row['qtmax'],
                "tipo" => $row['tipo'],
                "departamento_descricao" => $row['departamento_descricao']
            );
            array_push($secoes, $secao);
        }

        // Retornar os resultados
        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "vendedor_id" => $vendedor_id,
            "departamentos" => $departamentos,
            "secoes" => $secoes
        ));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array(
            "success" => false,
            "message" => "Erro ao obter filtros do vendedor: " . $e->getMessage()
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