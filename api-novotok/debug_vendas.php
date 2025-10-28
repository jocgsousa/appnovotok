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
        if (!isset($_GET['tipo']) || empty($_GET['tipo'])) {
            http_response_code(400);
            echo json_encode(array(
                "success" => false,
                "message" => "Parâmetro 'tipo' é obrigatório (diarias, totais ou filtros)"
            ));
            exit;
        }

        $tipo = $_GET['tipo'];
        
        // Verificar se o tipo é válido
        if (!in_array($tipo, ['diarias', 'totais', 'filtros', 'metas'])) {
            http_response_code(400);
            echo json_encode(array(
                "success" => false,
                "message" => "Tipo inválido. Use 'diarias', 'totais', 'filtros' ou 'metas'"
            ));
            exit;
        }

        // Instanciar banco de dados
        $database = new Database();
        $db = $database->getConnection();

        // Obter estrutura da tabela e dados conforme o tipo
        $estrutura_tabela = array();
        $dados = array();

        if ($tipo === 'diarias') {
            // Obter estrutura da tabela vendas_diarias
            $query_estrutura = "DESCRIBE vendas_diarias";
            $stmt_estrutura = $db->prepare($query_estrutura);
            $stmt_estrutura->execute();
            $estrutura_tabela = $stmt_estrutura->fetchAll(PDO::FETCH_ASSOC);

            // Obter alguns dados de exemplo
            $query_dados = "SELECT * FROM vendas_diarias ORDER BY data DESC LIMIT 10";
            $stmt_dados = $db->prepare($query_dados);
            $stmt_dados->execute();
            $dados = $stmt_dados->fetchAll(PDO::FETCH_ASSOC);
        } elseif ($tipo === 'totais') {
            // Obter estrutura da tabela vendas_totais
            $query_estrutura = "DESCRIBE vendas_totais";
            $stmt_estrutura = $db->prepare($query_estrutura);
            $stmt_estrutura->execute();
            $estrutura_tabela = $stmt_estrutura->fetchAll(PDO::FETCH_ASSOC);

            // Obter alguns dados de exemplo
            $query_dados = "SELECT * FROM vendas_totais ORDER BY data_inicio DESC LIMIT 10";
            $stmt_dados = $db->prepare($query_dados);
            $stmt_dados->execute();
            $dados = $stmt_dados->fetchAll(PDO::FETCH_ASSOC);
        } elseif ($tipo === 'filtros') {
            // Obter estrutura das tabelas de filtros
            $estrutura_tabela = array(
                'vendedor_departamentos' => array(),
                'vendedor_secoes' => array(),
                'departamentos' => array(),
                'secao' => array()
            );
            
            $query_estrutura_vd = "DESCRIBE vendedor_departamentos";
            $stmt_estrutura_vd = $db->prepare($query_estrutura_vd);
            $stmt_estrutura_vd->execute();
            $estrutura_tabela['vendedor_departamentos'] = $stmt_estrutura_vd->fetchAll(PDO::FETCH_ASSOC);
            
            $query_estrutura_vs = "DESCRIBE vendedor_secoes";
            $stmt_estrutura_vs = $db->prepare($query_estrutura_vs);
            $stmt_estrutura_vs->execute();
            $estrutura_tabela['vendedor_secoes'] = $stmt_estrutura_vs->fetchAll(PDO::FETCH_ASSOC);
            
            $query_estrutura_d = "DESCRIBE departamentos";
            $stmt_estrutura_d = $db->prepare($query_estrutura_d);
            $stmt_estrutura_d->execute();
            $estrutura_tabela['departamentos'] = $stmt_estrutura_d->fetchAll(PDO::FETCH_ASSOC);
            
            $query_estrutura_s = "DESCRIBE secao";
            $stmt_estrutura_s = $db->prepare($query_estrutura_s);
            $stmt_estrutura_s->execute();
            $estrutura_tabela['secao'] = $stmt_estrutura_s->fetchAll(PDO::FETCH_ASSOC);

            // Obter alguns dados de exemplo
            $dados = array(
                'vendedor_departamentos' => array(),
                'vendedor_secoes' => array(),
                'departamentos' => array(),
                'secao' => array()
            );
            
            $query_dados_vd = "SELECT * FROM vendedor_departamentos LIMIT 10";
            $stmt_dados_vd = $db->prepare($query_dados_vd);
            $stmt_dados_vd->execute();
            $dados['vendedor_departamentos'] = $stmt_dados_vd->fetchAll(PDO::FETCH_ASSOC);
            
            $query_dados_vs = "SELECT * FROM vendedor_secoes LIMIT 10";
            $stmt_dados_vs = $db->prepare($query_dados_vs);
            $stmt_dados_vs->execute();
            $dados['vendedor_secoes'] = $stmt_dados_vs->fetchAll(PDO::FETCH_ASSOC);
            
            $query_dados_d = "SELECT * FROM departamentos LIMIT 10";
            $stmt_dados_d = $db->prepare($query_dados_d);
            $stmt_dados_d->execute();
            $dados['departamentos'] = $stmt_dados_d->fetchAll(PDO::FETCH_ASSOC);
            
            $query_dados_s = "SELECT * FROM secao LIMIT 10";
            $stmt_dados_s = $db->prepare($query_dados_s);
            $stmt_dados_s->execute();
            $dados['secao'] = $stmt_dados_s->fetchAll(PDO::FETCH_ASSOC);
        } elseif ($tipo === 'metas') {
            // Obter estrutura das tabelas de metas
            $estrutura_tabela = array(
                'metas_vendas' => array(),
                'metas_cadastro_clientes' => array(),
                'historico_atualizacao_metas' => array()
            );
            
            $query_estrutura_mv = "DESCRIBE metas_vendas";
            $stmt_estrutura_mv = $db->prepare($query_estrutura_mv);
            $stmt_estrutura_mv->execute();
            $estrutura_tabela['metas_vendas'] = $stmt_estrutura_mv->fetchAll(PDO::FETCH_ASSOC);
            
            $query_estrutura_mc = "DESCRIBE metas_cadastro_clientes";
            $stmt_estrutura_mc = $db->prepare($query_estrutura_mc);
            $stmt_estrutura_mc->execute();
            $estrutura_tabela['metas_cadastro_clientes'] = $stmt_estrutura_mc->fetchAll(PDO::FETCH_ASSOC);
            
            $query_estrutura_hm = "DESCRIBE historico_atualizacao_metas";
            $stmt_estrutura_hm = $db->prepare($query_estrutura_hm);
            $stmt_estrutura_hm->execute();
            $estrutura_tabela['historico_atualizacao_metas'] = $stmt_estrutura_hm->fetchAll(PDO::FETCH_ASSOC);

            // Obter alguns dados de exemplo
            $dados = array(
                'metas_vendas' => array(),
                'metas_cadastro_clientes' => array(),
                'historico_atualizacao_metas' => array()
            );
            
            $query_dados_mv = "SELECT mv.*, v.nome as nome_vendedor, v.rca as rca_vendedor 
                              FROM metas_vendas mv 
                              LEFT JOIN vendedores v ON mv.vendedor_id = v.id 
                              ORDER BY mv.ano DESC, mv.mes DESC LIMIT 10";
            $stmt_dados_mv = $db->prepare($query_dados_mv);
            $stmt_dados_mv->execute();
            $dados['metas_vendas'] = $stmt_dados_mv->fetchAll(PDO::FETCH_ASSOC);
            
            $query_dados_mc = "SELECT mc.*, v.nome as nome_vendedor, v.rca as rca_vendedor 
                              FROM metas_cadastro_clientes mc 
                              LEFT JOIN vendedores v ON mc.vendedor_id = v.id 
                              ORDER BY mc.ano DESC, mc.mes DESC LIMIT 10";
            $stmt_dados_mc = $db->prepare($query_dados_mc);
            $stmt_dados_mc->execute();
            $dados['metas_cadastro_clientes'] = $stmt_dados_mc->fetchAll(PDO::FETCH_ASSOC);
            
            $query_dados_hm = "SELECT * FROM historico_atualizacao_metas ORDER BY id DESC LIMIT 10";
            $stmt_dados_hm = $db->prepare($query_dados_hm);
            $stmt_dados_hm->execute();
            $dados['historico_atualizacao_metas'] = $stmt_dados_hm->fetchAll(PDO::FETCH_ASSOC);
        }

        // Retornar os resultados
        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "tipo" => $tipo,
            "estrutura_tabela" => $estrutura_tabela,
            "dados" => $dados
        ));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array(
            "success" => false,
            "message" => "Erro ao depurar vendas: " . $e->getMessage()
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