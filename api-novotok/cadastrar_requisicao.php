<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

header('Content-Type: application/json');

try {
    // Verificar token JWT
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['error' => 'Token de autorização não fornecido']);
        exit;
    }
    
    $token = $matches[1];
    $user_id = JwtUtils::validateToken($token);
    
    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['error' => 'Token inválido']);
        exit;
    }

    // Inicializar banco de dados
    $database = new Database();
    $conn = $database->getConnection();

    // Obter dados do corpo da requisição
    $data = json_decode(file_get_contents("php://input"));

    // Verificar se os dados necessários foram fornecidos
    if (!isset($data->filial) || !isset($data->caixa) || !isset($data->datavendas)) {
        echo json_encode([
            'error' => true,
            'message' => 'Dados incompletos. Filial, caixa e data de vendas são obrigatórios.'
        ]);
        exit();
    }
    // Verificar se já existe uma requisição para a mesma filial, caixa e data
    $check_query = "SELECT id FROM request WHERE filial = :filial AND caixa = :caixa AND datavendas = :datavendas";
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->bindParam(':filial', $data->filial);
    $check_stmt->bindParam(':caixa', $data->caixa);
    $check_stmt->bindParam(':datavendas', $data->datavendas);
    $check_stmt->execute();
    
    if ($check_stmt->rowCount() > 0) {
        echo json_encode([
            'error' => true,
            'message' => 'Já existe uma requisição para esta filial, caixa e data.'
        ]);
        exit();
    }
    
    // Inserir nova requisição
    $query = "INSERT INTO request (filial, caixa, datavendas, nregistros, initial) VALUES (:filial, :caixa, :datavendas, :nregistros, :initial)";
    $stmt = $conn->prepare($query);
    
    // Vincular parâmetros
    $stmt->bindParam(':filial', $data->filial);
    $stmt->bindParam(':caixa', $data->caixa);
    $stmt->bindParam(':datavendas', $data->datavendas);
    
    // Valores opcionais
    $nregistros = isset($data->nregistros) ? $data->nregistros : null;
    $initial = isset($data->initial) ? $data->initial : false;
    
    $stmt->bindParam(':nregistros', $nregistros);
    $stmt->bindParam(':initial', $initial, PDO::PARAM_BOOL);
    
    // Executar a inserção
    if ($stmt->execute()) {
        $id = $conn->lastInsertId();
        
        echo json_encode([
            'message' => 'Requisição de sincronização criada com sucesso.',
            'id' => $id
        ]);
    } else {
        echo json_encode([
            'error' => true,
            'message' => 'Não foi possível criar a requisição de sincronização.'
        ]);
    }
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'Erro ao criar requisição: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?>