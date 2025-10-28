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
    echo json_encode(array("status" => 0, "message" => "Não autorizado"));
    exit;
}

// Método GET
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Instanciar banco de dados
        $database = new Database();
        $db = $database->getConnection();

        // Verificar se a tabela existe
        $query_check = "SELECT COUNT(*) FROM information_schema.tables 
                       WHERE table_schema = DATABASE() 
                       AND table_name = 'historico_atualizacao_metas'";
        $stmt_check = $db->prepare($query_check);
        $stmt_check->execute();
        $table_exists = (bool)$stmt_check->fetchColumn();

        if (!$table_exists) {
            // Retornar um array vazio se a tabela não existir
            http_response_code(200);
            echo json_encode(array(
                "status" => 1,
                "message" => "Tabela de histórico não encontrada",
                "historico" => [],
                "total_registros" => 0,
                "total_paginas" => 0,
                "pagina_atual" => 1
            ));
            exit;
        }

        // Parâmetros de paginação
        $pagina = isset($_GET['pagina']) ? intval($_GET['pagina']) : 1;
        $registros_por_pagina = isset($_GET['por_pagina']) ? intval($_GET['por_pagina']) : 10;
        
        // Validar parâmetros de paginação
        if ($pagina < 1) $pagina = 1;
        if ($registros_por_pagina < 1) $registros_por_pagina = 10;
        if ($registros_por_pagina > 100) $registros_por_pagina = 100; // Limite máximo
        
        $offset = ($pagina - 1) * $registros_por_pagina;

        // Construir a query base para contagem
        $query_count = "SELECT COUNT(*) FROM historico_atualizacao_metas h WHERE 1=1";
        
        // Construir a query base para dados
        $query = "SELECT h.*, 
                  v.nome as nome_vendedor, 
                  v.rca as rca_vendedor 
                  FROM historico_atualizacao_metas h
                  LEFT JOIN vendedores v ON h.vendedor_id = v.id
                  WHERE 1=1";
        
        // Parâmetros para filtros
        $params = array();

        // Adicionar filtros se fornecidos
        if (isset($_GET['meta_id']) && !empty($_GET['meta_id'])) {
            $query .= " AND h.meta_id = :meta_id";
            $query_count .= " AND h.meta_id = :meta_id";
            $params[':meta_id'] = $_GET['meta_id'];
        }

        if (isset($_GET['tipo_meta']) && !empty($_GET['tipo_meta'])) {
            $query .= " AND h.tipo_meta = :tipo_meta";
            $query_count .= " AND h.tipo_meta = :tipo_meta";
            $params[':tipo_meta'] = $_GET['tipo_meta'];
        }

        if (isset($_GET['vendedor_id']) && !empty($_GET['vendedor_id'])) {
            $query .= " AND h.vendedor_id = :vendedor_id";
            $query_count .= " AND h.vendedor_id = :vendedor_id";
            $params[':vendedor_id'] = $_GET['vendedor_id'];
        }

        if (isset($_GET['mes']) && !empty($_GET['mes'])) {
            $query .= " AND h.mes = :mes";
            $query_count .= " AND h.mes = :mes";
            $params[':mes'] = $_GET['mes'];
        }

        if (isset($_GET['ano']) && !empty($_GET['ano'])) {
            $query .= " AND h.ano = :ano";
            $query_count .= " AND h.ano = :ano";
            $params[':ano'] = $_GET['ano'];
        }

        // Ordenar por data de atualização (mais recente primeiro)
        $query .= " ORDER BY h.id DESC";
        
        // Adicionar limites para paginação
        $query .= " LIMIT :offset, :limit";
        $params[':offset'] = $offset;
        $params[':limit'] = $registros_por_pagina;

        // Executar a query de contagem
        $stmt_count = $db->prepare($query_count);
        
        // Vincular parâmetros para a query de contagem (exceto offset e limit)
        foreach ($params as $param => $value) {
            if ($param !== ':offset' && $param !== ':limit') {
                $stmt_count->bindValue($param, $value);
            }
        }
        
        $stmt_count->execute();
        $total_registros = $stmt_count->fetchColumn();
        $total_paginas = ceil($total_registros / $registros_por_pagina);
        
        // Preparar e executar a query principal
        $stmt = $db->prepare($query);
        
        // Vincular parâmetros
        foreach ($params as $param => $value) {
            if ($param === ':offset' || $param === ':limit') {
                $stmt->bindValue($param, $value, PDO::PARAM_INT);
            } else {
                $stmt->bindValue($param, $value);
            }
        }
        
        $stmt->execute();
        $historico = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Processar os resultados para adicionar informações formatadas
        foreach ($historico as &$item) {
            // Adicionar nome do mês
            $meses = [
                'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
            ];
            $item['nome_mes'] = $meses[$item['mes'] - 1];
            $item['periodo'] = $item['nome_mes'] . '/' . $item['ano'];
            
            // Formatar data de atualização
            if (isset($item['data_atualizacao'])) {
                $data = new DateTime($item['data_atualizacao']);
                $item['data_formatada'] = $data->format('d/m/Y H:i:s');
            }
        }

        // Retornar os resultados
        http_response_code(200);
        echo json_encode(array(
            "status" => 1,
            "message" => "Histórico de metas listado com sucesso",
            "historico" => $historico,
            "total_registros" => $total_registros,
            "total_paginas" => $total_paginas,
            "pagina_atual" => $pagina,
            "registros_por_pagina" => $registros_por_pagina
        ));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array(
            "status" => 0,
            "message" => "Erro ao listar histórico de metas: " . $e->getMessage()
        ));
    }
} else {
    // Método não permitido
    http_response_code(405);
    echo json_encode(array(
        "status" => 0,
        "message" => "Método não permitido"
    ));
} 