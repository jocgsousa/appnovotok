<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

// Definir cabeçalho para resposta JSON
header('Content-Type: application/json');

// Verificar se a requisição é GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit;
}

// Verificar autenticação
$headers = getallheaders();
$authHeader = null;

// Verificar se o cabeçalho Authorization existe (com diferentes casos)
foreach ($headers as $key => $value) {
    $lowerKey = strtolower($key);
    if ($lowerKey === 'authorization') {
        $authHeader = $value;
        break;
    }
}

if (!$authHeader) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token não fornecido']);
    exit;
}

try {
    // Validar o token
    $jwt = str_replace('Bearer ', '', $authHeader);
    $user_id = JwtUtils::validateToken($jwt);

    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token inválido']);
        exit;
    }

    // Verificar se o ID foi fornecido
    if (!isset($_GET['id']) || empty($_GET['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID do cliente não fornecido']);
        exit;
    }

    $cliente_id = $_GET['id'];

    // Inicializar a conexão com o banco de dados
    $database = new Database();
    $conn = $database->getConnection();

    // Consultar cliente com informações relacionadas
    $sql = "SELECT c.*, a.ramo as ramo_nome, pc.nomecidade as cidade_nome, pc.uf 
            FROM clientes c 
            LEFT JOIN pcativi a ON c.activity_id = a.id
            LEFT JOIN pccidade pc ON c.city_id = pc.id
            WHERE c.id = :id 
            LIMIT 1";
    
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':id', $cliente_id);
    $stmt->execute();

    if ($stmt->rowCount() == 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Cliente não encontrado']);
        exit;
    }

    $cliente = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Formatar CPF/CNPJ com máscara
    $cpfCnpj = $cliente['person_identification_number'];
    if (strlen($cpfCnpj) === 11) {
        $cpfCnpj = substr($cpfCnpj, 0, 3) . '.' . substr($cpfCnpj, 3, 3) . '.' . substr($cpfCnpj, 6, 3) . '-' . substr($cpfCnpj, 9, 2);
    } elseif (strlen($cpfCnpj) === 14) {
        $cpfCnpj = substr($cpfCnpj, 0, 2) . '.' . substr($cpfCnpj, 2, 3) . '.' . substr($cpfCnpj, 5, 3) . '/' . substr($cpfCnpj, 8, 4) . '-' . substr($cpfCnpj, 12, 2);
    }

    // Formatar data de nascimento
    $dataNascimento = null;
    if (!empty($cliente['data_nascimento'])) {
        $dataNascimento = date('d/m/Y', strtotime($cliente['data_nascimento']));
    }
    
    // Formatar dados do cliente
    $clienteFormatado = [
        'id' => (int)$cliente['id'],
        'codcli' => $cliente['codcli'],
        'corporate' => (bool)$cliente['corporate'],
        'name' => $cliente['name'],
        'trade_name' => $cliente['trade_name'],
        'person_identification_number' => $cpfCnpj,
        'person_identification_number_raw' => $cliente['person_identification_number'],
        'state_inscription' => $cliente['state_inscription'],
        'commercial_address' => $cliente['commercial_address'],
        'commercial_address_number' => $cliente['commercial_address_number'],
        'business_district' => $cliente['business_district'],
        'commercial_zip_code' => $cliente['commercial_zip_code'],
        'billingPhone' => $cliente['billingPhone'],
        'email' => $cliente['email'],
        'email_nfe' => $cliente['email_nfe'],
        'activity_id' => (int)$cliente['activity_id'],
        'ramo_nome' => $cliente['ramo_nome'],
        'business_city' => $cliente['business_city'],
        'city_id' => (int)$cliente['city_id'],
        'cidade_nome' => $cliente['cidade_nome'],
        'uf' => $cliente['uf'],
        'filial' => $cliente['filial'],
        'rca' => $cliente['rca'],
        'data_nascimento' => $dataNascimento,
        'created_at' => $cliente['created_at'],
        'updated_at' => $cliente['updated_at'],
        'novo' => isset($cliente['novo']) ? (bool)$cliente['novo'] : ($cliente['created_at'] === $cliente['updated_at']),
        'atualizado' => isset($cliente['atualizado']) ? (bool)$cliente['atualizado'] : ($cliente['created_at'] !== $cliente['updated_at']),
        'recused' => isset($cliente['recused']) ? (bool)$cliente['recused'] : false,
        'recused_msg' => $cliente['recused_msg'] ?? '',
        'registered' => isset($cliente['registered']) ? (bool)$cliente['registered'] : false,
        'authorized' => isset($cliente['authorized']) ? (bool)$cliente['authorized'] : false
    ];

    echo json_encode([
        'success' => true,
        'cliente' => $clienteFormatado
    ]);

} catch (PDOException $e) {
    error_log("Erro PDO ao obter cliente: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao consultar banco de dados: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Erro ao obter cliente: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 