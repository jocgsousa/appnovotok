<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

// Definir cabeçalho para resposta JSON
header('Content-Type: application/json');

// Verificar se a requisição é POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit;
}

// Verificar autenticação
$headers = getallheaders();
if (!isset($headers['Authorization'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token não fornecido']);
    exit;
}

try {
    // Validar o token
    $jwt = str_replace('Bearer ', '', $headers['Authorization']);
    $user_id = JwtUtils::validateToken($jwt);

    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token inválido']);
        exit;
    }

    // Receber dados do corpo da requisição
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Verificar se os dados necessários foram fornecidos
    if (!isset($data['codusur']) || !isset($data['data_inicio']) || !isset($data['data_fim'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dados incompletos. É necessário fornecer codusur, data_inicio e data_fim']);
        exit;
    }
    
    $codusur = $data['codusur'];
    $data_inicio = $data['data_inicio'];
    $data_fim = $data['data_fim'];
    
    // Inicializar a conexão com o banco de dados
    $database = new Database();
    $conn = $database->getConnection();
    
    // Verificar se existem vendas diárias para o período e vendedor
    $stmt = $conn->prepare("
        SELECT COUNT(*) 
        FROM vendas_diarias 
        WHERE codusur = :codusur 
        AND data BETWEEN :data_inicio AND :data_fim
    ");
    $stmt->execute([
        'codusur' => $codusur,
        'data_inicio' => $data_inicio,
        'data_fim' => $data_fim
    ]);
    
    if ($stmt->fetchColumn() == 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Não foram encontradas vendas diárias para o período e vendedor informados']);
        exit;
    }
    
    // Calcular os totais
    $stmt = $conn->prepare("
        SELECT 
            codusur,
            nome,
            CAST(AVG(qtd_pedidos) AS DECIMAL(10,2)) as total_qtd_pedidos,
            CAST(AVG(media_itens) AS DECIMAL(10,2)) as total_media_itens,
            CAST(AVG(ticket_medio) AS DECIMAL(10,2)) as total_ticket_medio,
            CAST(SUM(vlcustofin) AS DECIMAL(10,2)) as total_vlcustofin,
            SUM(qtcliente) as total_qtcliente,
            CAST(AVG(via) AS DECIMAL(10,2)) as total_via,
            CAST(SUM(vlvendadodia) AS DECIMAL(10,2)) as total_vlvendadodia,
            CAST(SUM(vldevolucao) AS DECIMAL(10,2)) as total_vldevolucao,
            CAST(SUM(valor_total) AS DECIMAL(10,2)) as total_valor
        FROM vendas_diarias
        WHERE codusur = :codusur 
        AND data BETWEEN :data_inicio AND :data_fim
        GROUP BY codusur, nome
    ");
    $stmt->execute([
        'codusur' => $codusur,
        'data_inicio' => $data_inicio,
        'data_fim' => $data_fim
    ]);
    
    $totais = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$totais) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro ao calcular totais']);
        exit;
    }
    
    // Log dos valores calculados para diagnóstico
    error_log("===== VALORES CALCULADOS EM calcular_totais_vendas.php =====");
    error_log("total_vlcustofin: " . $totais['total_vlcustofin'] . " (tipo: " . gettype($totais['total_vlcustofin']) . ")");
    error_log("total_vlvendadodia: " . $totais['total_vlvendadodia'] . " (tipo: " . gettype($totais['total_vlvendadodia']) . ")");
    error_log("total_vldevolucao: " . $totais['total_vldevolucao'] . " (tipo: " . gettype($totais['total_vldevolucao']) . ")");
    error_log("total_valor: " . $totais['total_valor'] . " (tipo: " . gettype($totais['total_valor']) . ")");
    error_log("=====================================================");
    
    // Verificar se já existe um registro para este período e vendedor
    $stmt = $conn->prepare("
        SELECT id FROM vendas_totais 
        WHERE codusur = :codusur 
        AND data_inicio = :data_inicio 
        AND data_fim = :data_fim
    ");
    $stmt->execute([
        'codusur' => $codusur,
        'data_inicio' => $data_inicio,
        'data_fim' => $data_fim
    ]);
    
    $registro_existente = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($registro_existente) {
        // Atualizar registro existente
        $stmt = $conn->prepare("
            UPDATE vendas_totais SET
                total_qtd_pedidos = :total_qtd_pedidos,
                total_media_itens = :total_media_itens,
                total_ticket_medio = :total_ticket_medio,
                total_vlcustofin = :total_vlcustofin,
                total_qtcliente = :total_qtcliente,
                total_via = :total_via,
                total_vlvendadodia = :total_vlvendadodia,
                total_vldevolucao = :total_vldevolucao,
                total_valor = :total_valor,
                updated_at = NOW()
            WHERE id = :id
        ");
        
        $stmt->execute([
            'id' => $registro_existente['id'],
            'total_qtd_pedidos' => (float) $totais['total_qtd_pedidos'],
            'total_media_itens' => (float) $totais['total_media_itens'],
            'total_ticket_medio' => (float) $totais['total_ticket_medio'],
            'total_vlcustofin' => (float) $totais['total_vlcustofin'],
            'total_qtcliente' => (int) $totais['total_qtcliente'],
            'total_via' => (float) $totais['total_via'],
            'total_vlvendadodia' => (float) $totais['total_vlvendadodia'],
            'total_vldevolucao' => (float) $totais['total_vldevolucao'],
            'total_valor' => (float) $totais['total_valor']
        ]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Totais atualizados com sucesso',
            'id' => $registro_existente['id'],
            'action' => 'update'
        ]);
    } else {
        // Inserir novo registro
        $stmt = $conn->prepare("
            INSERT INTO vendas_totais (
                codusur, nome, data_inicio, data_fim,
                total_qtd_pedidos, total_media_itens, total_ticket_medio,
                total_vlcustofin, total_qtcliente, total_via,
                total_vlvendadodia, total_vldevolucao, total_valor
            ) VALUES (
                :codusur, :nome, :data_inicio, :data_fim,
                :total_qtd_pedidos, :total_media_itens, :total_ticket_medio,
                :total_vlcustofin, :total_qtcliente, :total_via,
                :total_vlvendadodia, :total_vldevolucao, :total_valor
            )
        ");
        
        $stmt->execute([
            'codusur' => $codusur,
            'nome' => $totais['nome'],
            'data_inicio' => $data_inicio,
            'data_fim' => $data_fim,
            'total_qtd_pedidos' => (float) $totais['total_qtd_pedidos'],
            'total_media_itens' => (float) $totais['total_media_itens'],
            'total_ticket_medio' => (float) $totais['total_ticket_medio'],
            'total_vlcustofin' => (float) $totais['total_vlcustofin'],
            'total_qtcliente' => (int) $totais['total_qtcliente'],
            'total_via' => (float) $totais['total_via'],
            'total_vlvendadodia' => (float) $totais['total_vlvendadodia'],
            'total_vldevolucao' => (float) $totais['total_vldevolucao'],
            'total_valor' => (float) $totais['total_valor']
        ]);
        
        $id = $conn->lastInsertId();
        
        echo json_encode([
            'success' => true,
            'message' => 'Totais calculados e salvos com sucesso',
            'id' => $id,
            'action' => 'insert'
        ]);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao calcular totais: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 