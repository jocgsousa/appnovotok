<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

// Definir cabeçalho para resposta JSON
header('Content-Type: application/json');

// Habilitar log de depuração
error_log("vendedor_listar_vendas_diarias.php iniciado");

// Verificar se a requisição é GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit;
}

// Verificar autenticação
$headers = getallheaders();
error_log("Headers recebidos: " . json_encode($headers));

// Verificar se o cabeçalho Authorization existe (com diferentes casos)
$authHeader = null;
foreach ($headers as $key => $value) {
    $lowerKey = strtolower($key);
    if ($lowerKey === 'authorization') {
        $authHeader = $value;
        break;
    }
}

if (!$authHeader) {
    error_log("Token não fornecido no cabeçalho");
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token não fornecido']);
    exit;
}

try {
    // Validar o token
    $jwt = str_replace('Bearer ', '', $authHeader);
    error_log("Token recebido: " . $jwt);
    
    $user_id = JwtUtils::validateToken($jwt);
    error_log("Resultado da validação do token: " . ($user_id ? "Válido (ID: $user_id)" : "Inválido"));

    // Se o token for inválido, tentamos verificar se é um vendedor pelo RCA
    if (!$user_id) {
        // Verificar se temos o RCA na query string
        if (!isset($_GET['codusur']) || empty($_GET['codusur'])) {
            error_log("Token inválido e código do vendedor não fornecido");
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Token inválido e código do vendedor não fornecido']);
            exit;
        }

        $codusur = $_GET['codusur'];
        error_log("Tentando autenticar pelo código do vendedor: $codusur");
        
        // Inicializar a conexão com o banco de dados
        $database = new Database();
        $conn = $database->getConnection();
        
        // Verificar se o vendedor existe
        $stmt = $conn->prepare("SELECT id FROM vendedores WHERE rca = :rca LIMIT 1");
        $stmt->bindParam(':rca', $codusur);
        $stmt->execute();
        
        if ($stmt->rowCount() == 0) {
            error_log("Vendedor não encontrado: $codusur");
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Vendedor não encontrado']);
            exit;
        }
        
        // Vendedor existe, permitimos o acesso apenas aos seus próprios dados
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $user_id = $row['id'];
        
        // Log para depuração
        error_log("Acesso permitido para vendedor RCA: $codusur, ID: $user_id sem token válido");
    }

    // Inicializar a conexão com o banco de dados
    $database = new Database();
    $conn = $database->getConnection();

    // Obter parâmetros de filtro
    $codusur = isset($_GET['codusur']) ? $_GET['codusur'] : null;
    $data_inicio = isset($_GET['data_inicio']) ? $_GET['data_inicio'] : null;
    $data_fim = isset($_GET['data_fim']) ? $_GET['data_fim'] : null;
    
    error_log("Parâmetros de filtro: codusur=$codusur, data_inicio=$data_inicio, data_fim=$data_fim");

    // Construir a consulta SQL com base nos filtros
    $sql = "SELECT * FROM vendas_diarias WHERE 1=1";
    $params = [];

    if ($codusur) {
        $sql .= " AND codusur = :codusur";
        $params['codusur'] = $codusur;
    }

    if ($data_inicio) {
        $sql .= " AND data >= :data_inicio";
        $params['data_inicio'] = $data_inicio;
    }

    if ($data_fim) {
        $sql .= " AND data <= :data_fim";
        $params['data_fim'] = $data_fim;
    }

    $sql .= " ORDER BY data DESC";
    error_log("SQL: $sql");
    error_log("Parâmetros: " . json_encode($params));

    // Preparar e executar a consulta
    $stmt = $conn->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue(':' . $key, $value);
    }
    $stmt->execute();

    // Obter resultados
    $vendas_diarias = $stmt->fetchAll(PDO::FETCH_ASSOC);
    error_log("Registros encontrados: " . count($vendas_diarias));

    // Calcular totais
    $total_qtd_pedidos = 0;
    $total_media_itens = 0;
    $total_ticket_medio = 0;
    $total_vlcustofin = 0;
    $total_qtcliente = 0;
    $total_via = 0;
    $total_vlvendadodia = 0;
    $total_vldevolucao = 0;
    $total_valor = 0;

    // Calcular somas para valores que devem ser somados
    foreach ($vendas_diarias as $venda) {
        $total_vlcustofin += $venda['vlcustofin'];
        $total_qtcliente += $venda['qtcliente'];
        $total_vlvendadodia += $venda['vlvendadodia'];
        $total_vldevolucao += $venda['vldevolucao'];
        $total_valor += $venda['valor_total'];
    }

    // Calcular médias para os campos especificados
    if (count($vendas_diarias) > 0) {
        $soma_qtd_pedidos = 0;
        $soma_media_itens = 0;
        $soma_ticket_medio = 0;
        $soma_via = 0;

        foreach ($vendas_diarias as $venda) {
            $soma_qtd_pedidos += $venda['qtd_pedidos'];
            $soma_media_itens += $venda['media_itens'];
            $soma_ticket_medio += $venda['ticket_medio'];
            $soma_via += $venda['via'];
        }

        $total_qtd_pedidos = $soma_qtd_pedidos / count($vendas_diarias);
        $total_media_itens = $soma_media_itens / count($vendas_diarias);
        $total_ticket_medio = $soma_ticket_medio / count($vendas_diarias);
        $total_via = $soma_via / count($vendas_diarias);
    }

    // Formatar os dados para o formato esperado pelo frontend
    $diasVendas = [];
    foreach ($vendas_diarias as $venda) {
        $diasVendas[] = [
            'id' => $venda['id'],
            'data' => date('d/m/Y', strtotime($venda['data'])),
            'codusur' => $venda['codusur'],
            'nome' => $venda['nome'],
            'media_itens' => (float)$venda['media_itens'],
            'ticket_medio' => (float)$venda['ticket_medio'],
            'vlcustofin' => (float)$venda['vlcustofin'],
            'qtcliente' => (int)$venda['qtcliente'],
            'qtd_pedidos' => (int)$venda['qtd_pedidos'],
            'via' => (float)$venda['via'],
            'vlvendadodia' => (float)$venda['vlvendadodia'],
            'vldevolucao' => (float)$venda['vldevolucao'],
            'valor_total' => (float)$venda['valor_total']
        ];
    }

    // Obter nome do vendedor para o resultado
    $nome_vendedor = !empty($vendas_diarias) ? $vendas_diarias[0]['nome'] : '';
    $codigo_vendedor = !empty($vendas_diarias) ? $vendas_diarias[0]['codusur'] : '';

    // Montar resposta
    $response = [
        'success' => true,
        'codUsuario' => $codigo_vendedor,
        'nome' => $nome_vendedor,
        'diasVendas' => $diasVendas,
        'total_qtd_pedidos' => $total_qtd_pedidos,
        'total_media_itens' => $total_media_itens,
        'total_ticket_medio' => $total_ticket_medio,
        'total_vlcustofin' => $total_vlcustofin,
        'total_qtcliente' => $total_qtcliente,
        'total_via' => $total_via,
        'total_vlvendadodia' => $total_vlvendadodia,
        'total_vldevolucao' => $total_vldevolucao,
        'total_valor' => $total_valor
    ];

    error_log("Resposta gerada com sucesso");
    echo json_encode($response);

} catch (PDOException $e) {
    error_log("Erro PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao consultar banco de dados: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Erro geral: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 