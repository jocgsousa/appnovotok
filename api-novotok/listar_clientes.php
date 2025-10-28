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

    // Inicializar a conexão com o banco de dados
    $database = new Database();
    $conn = $database->getConnection();

    // Obter parâmetros de filtro
    $rca = isset($_GET['rca']) ? $_GET['rca'] : null;
    $filial = isset($_GET['filial']) ? $_GET['filial'] : null;
    $busca = isset($_GET['busca']) ? $_GET['busca'] : null;
    $novo = isset($_GET['novo']) ? filter_var($_GET['novo'], FILTER_VALIDATE_BOOLEAN) : null;
    $atualizado = isset($_GET['atualizado']) ? filter_var($_GET['atualizado'], FILTER_VALIDATE_BOOLEAN) : null;
    $recused = isset($_GET['recused']) ? filter_var($_GET['recused'], FILTER_VALIDATE_BOOLEAN) : null;
    $data_inicio = isset($_GET['data_inicio']) ? $_GET['data_inicio'] : null;
    $data_fim = isset($_GET['data_fim']) ? $_GET['data_fim'] : null;
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
    $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;

    // Construir a consulta SQL com base nos filtros
    $sql = "SELECT c.*, a.ramo as ramo_nome, pc.nomecidade as cidade_nome, pc.uf 
            FROM clientes c 
            LEFT JOIN pcativi a ON c.activity_id = a.id
            LEFT JOIN pccidade pc ON c.city_id = pc.id
            WHERE 1=1";
    $params = [];

    if ($rca) {
        $sql .= " AND c.rca = :rca";
        $params[':rca'] = $rca;
    }

    if ($filial) {
        $sql .= " AND c.filial = :filial";
        $params[':filial'] = $filial;
    }

    if ($busca) {
        $sql .= " AND (c.name LIKE :busca1 OR c.person_identification_number LIKE :busca2 OR c.email LIKE :busca3 OR c.billingPhone LIKE :busca4)";
        $params[':busca1'] = "%$busca%";
        $params[':busca2'] = "%$busca%";
        $params[':busca3'] = "%$busca%";
        $params[':busca4'] = "%$busca%";
    }
    
    // Aplicar filtros de status mutuamente exclusivos
    if ($novo === true) {
        $sql .= " AND (c.novo = 1 OR (c.created_at = c.updated_at))";
        // Garantir que não é um registro recusado
        $sql .= " AND (c.recused IS NULL OR c.recused = 0)";
    } 
    else if ($atualizado === true) {
        // Selecionar somente registros com flag atualizado=1 ou que tenham sido modificados
        $sql .= " AND ((c.atualizado = 1) OR (c.created_at != c.updated_at AND c.created_at IS NOT NULL AND c.updated_at IS NOT NULL))";
        // Garantir que não é um registro novo
        $sql .= " AND (c.novo = 0 OR c.novo IS NULL)";
        // Garantir que não é um registro recusado
        $sql .= " AND (c.recused IS NULL OR c.recused = 0)";
    }
    else if ($recused === true) {
        $sql .= " AND c.recused = 1";
    }

    // Filtrar por período de cadastro (data_inicio e data_fim)
    if ($data_inicio) {
        $sql .= " AND DATE(c.created_at) >= :data_inicio";
        $params[':data_inicio'] = $data_inicio;
    }

    if ($data_fim) {
        $sql .= " AND DATE(c.created_at) <= :data_fim";
        $params[':data_fim'] = $data_fim;
    }

    // Adicionar ordenação e paginação - inserindo valores diretamente na string SQL
    $sql .= " ORDER BY c.created_at DESC LIMIT $limit OFFSET $offset";

    // Preparar e executar a consulta
    $stmt = $conn->prepare($sql);
    
    // Vincular parâmetros
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    
    $stmt->execute();

    // Obter resultados
    $clientes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Contar total de registros sem paginação
    $sqlCount = "SELECT COUNT(*) as total FROM clientes c WHERE 1=1";
    $paramsCount = [];

    if ($rca) {
        $sqlCount .= " AND c.rca = :rca";
        $paramsCount[':rca'] = $rca;
    }

    if ($filial) {
        $sqlCount .= " AND c.filial = :filial";
        $paramsCount[':filial'] = $filial;
    }

    if ($busca) {
        $sqlCount .= " AND (c.name LIKE :busca1 OR c.person_identification_number LIKE :busca2 OR c.email LIKE :busca3 OR c.billingPhone LIKE :busca4)";
        $paramsCount[':busca1'] = "%$busca%";
        $paramsCount[':busca2'] = "%$busca%";
        $paramsCount[':busca3'] = "%$busca%";
        $paramsCount[':busca4'] = "%$busca%";
    }
    
    // Aplicar os mesmos filtros de status na contagem
    if ($novo === true) {
        $sqlCount .= " AND (c.novo = 1 OR (c.created_at = c.updated_at))";
        // Garantir que não é um registro recusado
        $sqlCount .= " AND (c.recused IS NULL OR c.recused = 0)";
    } 
    else if ($atualizado === true) {
        // Selecionar somente registros com flag atualizado=1 ou que tenham sido modificados
        $sqlCount .= " AND ((c.atualizado = 1) OR (c.created_at != c.updated_at AND c.created_at IS NOT NULL AND c.updated_at IS NOT NULL))";
        // Garantir que não é um registro novo
        $sqlCount .= " AND (c.novo = 0 OR c.novo IS NULL)";
        // Garantir que não é um registro recusado
        $sqlCount .= " AND (c.recused IS NULL OR c.recused = 0)";
    }
    else if ($recused === true) {
        $sqlCount .= " AND c.recused = 1";
    }

    // Filtrar por período de cadastro (data_inicio e data_fim)
    if ($data_inicio) {
        $sqlCount .= " AND DATE(c.created_at) >= :data_inicio";
        $paramsCount[':data_inicio'] = $data_inicio;
    }

    if ($data_fim) {
        $sqlCount .= " AND DATE(c.created_at) <= :data_fim";
        $paramsCount[':data_fim'] = $data_fim;
    }

    $stmtCount = $conn->prepare($sqlCount);
    foreach ($paramsCount as $key => $value) {
        $stmtCount->bindValue($key, $value);
    }
    $stmtCount->execute();
    $totalRegistros = $stmtCount->fetch(PDO::FETCH_ASSOC)['total'];

    // Formatar os dados para o formato esperado pelo frontend
    $clientesFormatados = [];
    foreach ($clientes as $cliente) {
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

        $clientesFormatados[] = [
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
            'novo' => (isset($cliente['novo']) && (bool)$cliente['novo']) || (!isset($cliente['novo']) && $cliente['created_at'] === $cliente['updated_at']),
            'atualizado' => isset($cliente['atualizado']) ? (bool)$cliente['atualizado'] : ($cliente['created_at'] !== $cliente['updated_at']),
            'recused' => isset($cliente['recused']) ? (bool)$cliente['recused'] : false,
            'recused_msg' => $cliente['recused_msg'] ?? '',
            'registered' => isset($cliente['registered']) ? (bool)$cliente['registered'] : false,
            'authorized' => isset($cliente['authorized']) ? (bool)$cliente['authorized'] : false
        ];
    }

    echo json_encode([
        'success' => true,
        'total' => (int)$totalRegistros,
        'limit' => $limit,
        'offset' => $offset,
        'clientes' => $clientesFormatados
    ]);

} catch (PDOException $e) {
    error_log("Erro PDO ao listar clientes: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao consultar banco de dados: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Erro ao listar clientes: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 