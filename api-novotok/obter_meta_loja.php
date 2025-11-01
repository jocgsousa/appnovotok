<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: access");
header("Access-Control-Allow-Methods: GET");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require 'database.php';
require 'jwt_utils.php';
require 'cors_config.php';

// Verificar se o método da requisição é GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "status" => 0,
        "message" => "Método não permitido. Apenas GET é aceito."
    ]);
    exit;
}

// Verificar se o token JWT foi fornecido
$headers = getallheaders();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token de autenticação não fornecido ou inválido"
    ]);
    exit;
}

$jwt = $matches[1];

// Validar o token JWT
try {
    $payload = decodeJWT($jwt);
    $usuario_id = $payload->data->user_id;
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token inválido: " . $e->getMessage()
    ]);
    exit;
}

// Verificar se o ID da meta foi fornecido
if (!isset($_GET['id']) || empty($_GET['id'])) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "ID da meta é obrigatório."
    ]);
    exit;
}

$meta_id = trim($_GET['id']);

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

// Função auxiliar para obter nome do mês
function getNomeMes($mes) {
    $meses = [
        1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março', 4 => 'Abril',
        5 => 'Maio', 6 => 'Junho', 7 => 'Julho', 8 => 'Agosto',
        9 => 'Setembro', 10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro'
    ];
    return isset($meses[$mes]) ? $meses[$mes] : 'Mês inválido';
}

try {
    // Buscar a meta principal
    $sqlMeta = "SELECT 
                    ml.id,
                    ml.loja_id,
                    ml.nome_loja,
                    ml.mes,
                    ml.ano,
                    ml.grupo_meta_id,
                    ml.valor_venda_loja_total,
                    gm.nome as grupo_meta_nome,
                    gm.descricao as grupo_meta_descricao,
                    ml.ativo,
                    ml.data_criacao
                FROM metas_lojas ml
                LEFT JOIN grupos_metas_produtos gm ON ml.grupo_meta_id = gm.id
                WHERE ml.id = ?";
    
    $stmtMeta = $conn->prepare($sqlMeta);
    $stmtMeta->bindValue(1, $meta_id);
    $stmtMeta->execute();
    $meta = $stmtMeta->fetch(PDO::FETCH_ASSOC);

    if (!$meta) {
        http_response_code(404);
        echo json_encode([
            "status" => 0,
            "message" => "Meta não encontrada."
        ]);
        exit;
    }

    // Função para buscar metas de produtos por funcionário
    function buscarMetasProdutos($conn, $meta_id, $funcionario_id, $tipo_funcionario) {
        $sql = "SELECT id, nome_produto_marca, qtd_meta, qtd_vendido, percentual_sobre_venda, valor_vendido, valor_comissao 
                FROM meta_loja_produtos 
                WHERE meta_loja_id = ? AND funcionario_id = ? AND tipo_funcionario = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bindValue(1, $meta_id);
        $stmt->bindValue(2, $funcionario_id);
        $stmt->bindValue(3, $tipo_funcionario);
        $stmt->execute();
        
        $produtos = [];
        while ($produto = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $produtos[] = [
                'id' => $produto['id'],
                'nomeProdutoMarca' => $produto['nome_produto_marca'], // Convertido para camelCase
                'qtdMeta' => (int)$produto['qtd_meta'], // Convertido para camelCase
                'qtdVendido' => (int)$produto['qtd_vendido'], // Convertido para camelCase
                'percentualSobreVenda' => (float)$produto['percentual_sobre_venda'], // Convertido para camelCase
                'valorVendido' => (float)$produto['valor_vendido'], // Convertido para camelCase
                'valorComissao' => (float)$produto['valor_comissao'] // Convertido para camelCase
            ];
        }
        return $produtos;
    }

    // Buscar operadoras de caixa
    $sqlOperadoras = "SELECT id, nome, funcao, cadastros_positivados, produtos_destaque 
                      FROM meta_loja_operadoras_caixa 
                      WHERE meta_loja_id = ?";
    $stmtOperadoras = $conn->prepare($sqlOperadoras);
    $stmtOperadoras->bindValue(1, $meta_id);
    $stmtOperadoras->execute();
    
    $operadoras_caixa = [];
    while ($operadora = $stmtOperadoras->fetch(PDO::FETCH_ASSOC)) {
        $metasProdutos = buscarMetasProdutos($conn, $meta_id, $operadora['id'], 'operadora_caixa');
        $operadoras_caixa[] = [
            'id' => $operadora['id'],
            'nome' => $operadora['nome'],
            'funcao' => $operadora['funcao'],
            'cadastrosPositivados' => (int)$operadora['cadastros_positivados'],
            'produtosDestaque' => (int)$operadora['produtos_destaque'],
            'metasProdutos' => $metasProdutos
        ];
    }

    // Buscar vendedoras
    $sqlVendedoras = "SELECT id, nome, funcao, valor_vendido_total, esmaltes, profissional_parceiras, 
                             valor_vendido_make, quantidade_malka, valor_malka 
                      FROM meta_loja_vendedoras 
                      WHERE meta_loja_id = ?";
    $stmtVendedoras = $conn->prepare($sqlVendedoras);
    $stmtVendedoras->bindValue(1, $meta_id);
    $stmtVendedoras->execute();
    
    $vendedoras = [];
    while ($vendedora = $stmtVendedoras->fetch(PDO::FETCH_ASSOC)) {
        $metasProdutos = buscarMetasProdutos($conn, $meta_id, $vendedora['id'], 'vendedora');
        $vendedoras[] = [
            'id' => $vendedora['id'],
            'nome' => $vendedora['nome'],
            'funcao' => $vendedora['funcao'],
            'valorVendidoTotal' => (float)$vendedora['valor_vendido_total'],
            'esmaltes' => (int)$vendedora['esmaltes'],
            'profissionalParceiras' => (int)$vendedora['profissional_parceiras'],
            'valorVendidoMake' => (float)$vendedora['valor_vendido_make'],
            'quantidadeMalka' => (int)$vendedora['quantidade_malka'],
            'valorMalka' => (float)$vendedora['valor_malka'],
            'metasProdutos' => $metasProdutos
        ];
    }

    // Buscar vendedoras bijou
    $sqlVendedorasBijou = "SELECT id, nome, funcao, bijou_make_bolsas 
                           FROM meta_loja_vendedoras_bijou 
                           WHERE meta_loja_id = ?";
    $stmtVendedorasBijou = $conn->prepare($sqlVendedorasBijou);
    $stmtVendedorasBijou->bindValue(1, $meta_id);
    $stmtVendedorasBijou->execute();
    
    $vendedoras_bijou = [];
    while ($vendedora = $stmtVendedorasBijou->fetch(PDO::FETCH_ASSOC)) {
        $metasProdutos = buscarMetasProdutos($conn, $meta_id, $vendedora['id'], 'vendedora_bijou');
        $vendedoras_bijou[] = [
            'id' => $vendedora['id'],
            'nome' => $vendedora['nome'],
            'funcao' => $vendedora['funcao'],
            'bijouMakeBolsas' => (float)$vendedora['bijou_make_bolsas'],
            'metasProdutos' => $metasProdutos
        ];
    }

    // Buscar gerente
    $sqlGerente = "SELECT id, nome, valor_vendido_total, esmaltes, profissional_parceiras, 
                          valor_vendido_make, quantidade_malka, valor_malka, bijou_make_bolsas 
                   FROM meta_loja_gerente 
                   WHERE meta_loja_id = ?";
    $stmtGerente = $conn->prepare($sqlGerente);
    $stmtGerente->bindValue(1, $meta_id);
    $stmtGerente->execute();
    $gerenteData = $stmtGerente->fetch(PDO::FETCH_ASSOC);
    
    $gerente = null;
    if ($gerenteData) {
        $metasProdutos = buscarMetasProdutos($conn, $meta_id, $gerenteData['id'], 'gerente');
        $gerente = [
            'id' => $gerenteData['id'],
            'nome' => $gerenteData['nome'],
            'funcao' => 'Gerente', // Valor padrão já que a coluna não existe
            'valorVendidoTotal' => (float)$gerenteData['valor_vendido_total'],
            'esmaltes' => (int)$gerenteData['esmaltes'],
            'profissionalParceiras' => (int)$gerenteData['profissional_parceiras'],
            'valorVendidoMake' => (float)$gerenteData['valor_vendido_make'],
            'quantidadeMalka' => (int)$gerenteData['quantidade_malka'],
            'valorMalka' => (float)$gerenteData['valor_malka'],
            'bijouMakeBolsas' => (float)$gerenteData['bijou_make_bolsas'],
            'percentualMetaGeral' => 0.08, // Valor padrão já que a coluna não existe
            'metasProdutos' => $metasProdutos
        ];
    }

    // Buscar campanhas
    $sqlCampanhas = "SELECT id, nome, descricao 
                     FROM meta_loja_campanhas 
                     WHERE meta_loja_id = ?";
    $stmtCampanhas = $conn->prepare($sqlCampanhas);
    $stmtCampanhas->bindValue(1, $meta_id);
    $stmtCampanhas->execute();
    
    $campanhas = [];
    while ($campanha = $stmtCampanhas->fetch(PDO::FETCH_ASSOC)) {
        $campanhas[] = [
            'id' => $campanha['id'],
            'nome' => $campanha['nome'],
            'descricao' => $campanha['descricao']
        ];
    }

    // Buscar funcionários
    $sqlFuncionarios = "SELECT id, nome, funcao 
                        FROM meta_loja_funcionarios 
                        WHERE meta_loja_id = ?";
    $stmtFuncionarios = $conn->prepare($sqlFuncionarios);
    $stmtFuncionarios->bindValue(1, $meta_id);
    $stmtFuncionarios->execute();
    
    $funcionarios = [];
    while ($funcionario = $stmtFuncionarios->fetch(PDO::FETCH_ASSOC)) {
        $metasProdutos = buscarMetasProdutos($conn, $meta_id, $funcionario['id'], 'funcionario');
        $funcionarios[] = [
            'id' => $funcionario['id'],
            'nome' => $funcionario['nome'],
            'funcao' => $funcionario['funcao'],
            'metasProdutos' => $metasProdutos
        ];
    }

    // Montar resposta
    $response = [
        'id' => $meta['id'],
        'loja_id' => $meta['loja_id'],
        'nome_loja' => $meta['nome_loja'],
        'mes' => (int)$meta['mes'],
        'nomeMes' => getNomeMes((int)$meta['mes']),
        'ano' => (int)$meta['ano'],
        'periodo' => getNomeMes((int)$meta['mes']) . '/' . $meta['ano'],
        'grupo_meta_id' => $meta['grupo_meta_id'],
        'grupoMetaNome' => $meta['grupo_meta_nome'],
        'grupoMetaDescricao' => $meta['grupo_meta_descricao'],
        'valor_venda_loja_total' => (float)$meta['valor_venda_loja_total'],
        'ativo' => (bool)$meta['ativo'],
        'data_criacao' => $meta['data_criacao'],
        'operadoras_caixa' => $operadoras_caixa,
        'vendedoras' => $vendedoras,
        'vendedoras_bijou' => $vendedoras_bijou,
        'gerente' => $gerente,
        'campanhas' => $campanhas,
        'funcionarios' => $funcionarios
    ];

    http_response_code(200);
    echo json_encode([
        "status" => 1,
        "message" => "Meta obtida com sucesso",
        "data" => $response
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => 0,
        "message" => "Erro interno do servidor: " . $e->getMessage()
    ]);
}
?>