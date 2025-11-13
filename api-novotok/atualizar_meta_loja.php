<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: access");
header("Access-Control-Allow-Methods: PUT");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require 'database.php';
require 'jwt_utils.php';
require 'cors_config.php';

// Verificar se o método da requisição é PUT
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode([
        "status" => 0,
        "message" => "Método não permitido. Apenas PUT é aceito."
    ]);
    exit;
}

// Obter o conteúdo do corpo da requisição
$data = json_decode(file_get_contents("php://input"));

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

// Verificar se todos os dados necessários foram fornecidos
if (!isset($data->id) || !isset($data->loja_id) || !isset($data->nome_loja) || !isset($data->mes) || !isset($data->ano) || !isset($data->grupo_meta_id)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Dados incompletos. Forneça id, loja_id, nome_loja, mes, ano e grupo_meta_id."
    ]);
    exit;
}

// Validar os dados
$meta_id = trim($data->id);
$loja_id = trim($data->loja_id);
$nome_loja = trim($data->nome_loja);
$mes = (int)$data->mes;
$ano = (int)$data->ano;
$grupo_meta_id = trim($data->grupo_meta_id);
$ativo = isset($data->ativo) ? (bool)$data->ativo : true;
$valor_venda_loja_total = isset($data->valor_venda_loja_total) ? (float)$data->valor_venda_loja_total : 0;

// Dados das subseções
$operadoras_caixa = isset($data->operadoras_caixa) ? $data->operadoras_caixa : [];
$vendedoras = isset($data->vendedoras) ? $data->vendedoras : [];
$vendedoras_bijou = isset($data->vendedoras_bijou) ? $data->vendedoras_bijou : [];
$gerente = isset($data->gerente) ? $data->gerente : null;
$campanhas = isset($data->campanhas) ? $data->campanhas : [];
$funcionarios = isset($data->funcionarios) ? $data->funcionarios : [];

// Validações
if (empty($meta_id)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "ID da meta é obrigatório."
    ]);
    exit;
}

if (empty($loja_id)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "ID da loja é obrigatório."
    ]);
    exit;
}

if (empty($nome_loja)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Nome da loja é obrigatório."
    ]);
    exit;
}

if ($mes < 1 || $mes > 12) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Mês deve estar entre 1 e 12."
    ]);
    exit;
}

if ($ano < 2020 || $ano > 2050) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Ano deve estar entre 2020 e 2050."
    ]);
    exit;
}

if (empty($grupo_meta_id)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "ID do grupo de metas é obrigatório."
    ]);
    exit;
}

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

try {
    // Iniciar transação
    $conn->beginTransaction();

    // Verificar se a meta existe
    $sqlCheckMeta = "SELECT id FROM metas_lojas WHERE id = ?";
    $stmtCheckMeta = $conn->prepare($sqlCheckMeta);
    $stmtCheckMeta->bindValue(1, $meta_id);
    $stmtCheckMeta->execute();

    if ($stmtCheckMeta->rowCount() === 0) {
        $conn->rollBack();
        http_response_code(404);
        echo json_encode([
            "status" => 0,
            "message" => "Meta de loja não encontrada."
        ]);
        exit;
    }

    // Verificar se o grupo de metas existe e está ativo
    $sqlCheckGrupo = "SELECT id, nome, ativo FROM grupos_metas_produtos WHERE id = ?";
    $stmtCheckGrupo = $conn->prepare($sqlCheckGrupo);
    $stmtCheckGrupo->bindValue(1, $grupo_meta_id);
    $stmtCheckGrupo->execute();

    if ($stmtCheckGrupo->rowCount() === 0) {
        $conn->rollBack();
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Grupo de metas não encontrado."
        ]);
        exit;
    }

    $grupo = $stmtCheckGrupo->fetch(PDO::FETCH_ASSOC);
    if (!$grupo['ativo']) {
        $conn->rollBack();
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Não é possível usar um grupo de metas inativo."
        ]);
        exit;
    }

    // Verificar se já existe outra meta para esta loja no mesmo período
    $sqlCheckExistente = "SELECT id FROM metas_lojas WHERE loja_id = ? AND mes = ? AND ano = ? AND id != ?";
    $stmtCheckExistente = $conn->prepare($sqlCheckExistente);
    $stmtCheckExistente->bindValue(1, $loja_id);
    $stmtCheckExistente->bindValue(2, $mes);
    $stmtCheckExistente->bindValue(3, $ano);
    $stmtCheckExistente->bindValue(4, $meta_id);
    $stmtCheckExistente->execute();

    if ($stmtCheckExistente->rowCount() > 0) {
        $conn->rollBack();
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Já existe outra meta para esta loja no período informado."
        ]);
        exit;
    }

    // Atualizar a meta de loja principal
    $sql = "UPDATE metas_lojas SET loja_id = ?, nome_loja = ?, mes = ?, ano = ?, grupo_meta_id = ?, ativo = ?, valor_venda_loja_total = ? WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(1, $loja_id);
    $stmt->bindValue(2, $nome_loja);
    $stmt->bindValue(3, $mes);
    $stmt->bindValue(4, $ano);
    $stmt->bindValue(5, $grupo_meta_id);
    $stmt->bindValue(6, $ativo ? 1 : 0);
    $stmt->bindValue(7, $valor_venda_loja_total);
    $stmt->bindValue(8, $meta_id);
    $stmt->execute();

    // Função para remover dados antigos das subseções
    function removerDadosAntigos($conn, $meta_id) {
        $tabelas = [
            'meta_loja_operadoras_caixa',
            'meta_loja_vendedoras',
            'meta_loja_vendedoras_bijou',
            'meta_loja_gerente',
            'meta_loja_campanhas',
            'meta_loja_funcionarios',
            'meta_loja_produtos'
        ];
        
        foreach ($tabelas as $tabela) {
            $sql = "DELETE FROM $tabela WHERE meta_loja_id = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bindValue(1, $meta_id);
            $stmt->execute();
        }
    }

    // Função para salvar operadoras de caixa
    function salvarOperadorasCaixa($conn, $meta_id, $operadoras) {
        $sql = "INSERT INTO meta_loja_operadoras_caixa (id, meta_loja_id, nome, funcao, cadastros_positivados, produtos_destaque) 
                VALUES (?, ?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        
        foreach ($operadoras as $operadora) {
            $operadora_id = uniqid('operadora_', true);
            $stmt->bindValue(1, $operadora_id);
            $stmt->bindValue(2, $meta_id);
            $stmt->bindValue(3, $operadora->nome ?? '');
            $stmt->bindValue(4, $operadora->funcao ?? 'OPERADOR(A) DE CAIXA');
            // Mapear nomes dos campos do frontend para backend
            $stmt->bindValue(5, $operadora->cadastrosPositivados ?? $operadora->cadastros_positivados ?? 0);
            $stmt->bindValue(6, $operadora->produtosDestaque ?? $operadora->produtos_destaque ?? 0);
            $stmt->execute();
            
            // Salvar metas de produtos da operadora
            if (isset($operadora->metasProdutos) && is_array($operadora->metasProdutos)) {
                salvarMetasProdutos($conn, $meta_id, $operadora_id, 'operadora_caixa', $operadora->metasProdutos);
            }
        }
    }

    // Função para salvar vendedoras
    // Função para converter valores monetários formatados para números
    function converterValorMonetario($valor) {
        if (is_numeric($valor)) {
            return (float)$valor;
        }
        
        if (is_string($valor)) {
            // Remove símbolos de moeda, espaços e converte vírgulas para pontos
            $valor = preg_replace('/[R$\s\xA0\x{00A0}]/u', '', $valor);
            $valor = str_replace(['.', ','], ['', '.'], $valor);
            return is_numeric($valor) ? (float)$valor : 0;
        }
        
        return 0;
    }

    function salvarVendedoras($conn, $meta_id, $vendedoras) {
        $sql = "INSERT INTO meta_loja_vendedoras (id, meta_loja_id, nome, funcao, valor_vendido_total, esmaltes, profissional_parceiras, valor_vendido_make, quantidade_malka, valor_malka) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        
        foreach ($vendedoras as $vendedora) {
            $vendedora_id = uniqid('vendedora_', true);
            
            // Mapeamento para aceitar tanto camelCase quanto snake_case
            $valorVendidoTotal = $vendedora->valorVendidoTotal ?? $vendedora->valor_vendido_total ?? 0;
            $esmaltes = $vendedora->esmaltes ?? 0;
            $profissionalParceiras = $vendedora->profissionalParceiras ?? $vendedora->profissional_parceiras ?? 0;
            $valorVendidoMake = $vendedora->valorVendidoMake ?? $vendedora->valor_vendido_make ?? 0;
            $quantidadeMalka = $vendedora->quantidadeMalka ?? $vendedora->quantidade_malka ?? 0;
            $valorMalka = $vendedora->valorMalka ?? $vendedora->valor_malka ?? 0;
            
            $stmt->bindValue(1, $vendedora_id);
            $stmt->bindValue(2, $meta_id);
            $stmt->bindValue(3, $vendedora->nome ?? '');
            $stmt->bindValue(4, $vendedora->funcao ?? 'ATENDENTE DE LOJA');
            $stmt->bindValue(5, converterValorMonetario($valorVendidoTotal));
            $stmt->bindValue(6, converterValorMonetario($esmaltes));
            $stmt->bindValue(7, converterValorMonetario($profissionalParceiras));
            $stmt->bindValue(8, converterValorMonetario($valorVendidoMake));
            $stmt->bindValue(9, is_numeric($quantidadeMalka) ? (int)$quantidadeMalka : 0);
            $stmt->bindValue(10, converterValorMonetario($valorMalka));
            $stmt->execute();
            
            // Salvar metas de produtos da vendedora
            if (isset($vendedora->metasProdutos) && is_array($vendedora->metasProdutos)) {
                salvarMetasProdutos($conn, $meta_id, $vendedora_id, 'vendedora', $vendedora->metasProdutos);
            }
        }
    }

    // Função para salvar vendedoras bijou
    function salvarVendedorasBijou($conn, $meta_id, $vendedoras_bijou) {
        $sql = "INSERT INTO meta_loja_vendedoras_bijou (id, meta_loja_id, nome, funcao, bijou_make_bolsas, percentual_comissao_bijou, valor_comissao_bijou) 
                VALUES (?, ?, ?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        
        foreach ($vendedoras_bijou as $vendedora) {
            $vendedora_id = uniqid('vendedora_bijou_', true);
            
            // Mapeamento para aceitar tanto camelCase quanto snake_case
            $bijouMakeBolsas = $vendedora->bijouMakeBolsas ?? $vendedora->bijou_make_bolsas ?? 0;
            $percentualComissaoBijou = $vendedora->percentualComissaoBijou ?? $vendedora->percentual_comissao_bijou ?? 0;
            $valorComissaoBijou = $vendedora->valorComissaoBijou ?? $vendedora->valor_comissao_bijou ?? 0;
            
            $stmt->bindValue(1, $vendedora_id);
            $stmt->bindValue(2, $meta_id);
            $stmt->bindValue(3, $vendedora->nome ?? '');
            $stmt->bindValue(4, $vendedora->funcao ?? 'VENDEDORA BIJOU/MAKE/BOLSAS');
            $stmt->bindValue(5, converterValorMonetario($bijouMakeBolsas));
            $stmt->bindValue(6, is_numeric($percentualComissaoBijou) ? (float)$percentualComissaoBijou : 0);
            $stmt->bindValue(7, converterValorMonetario($valorComissaoBijou));
            $stmt->execute();
            
            // Salvar metas de produtos da vendedora bijou
            if (isset($vendedora->metasProdutos) && is_array($vendedora->metasProdutos)) {
                salvarMetasProdutos($conn, $meta_id, $vendedora_id, 'vendedora_bijou', $vendedora->metasProdutos);
            }
        }
    }

    // Função para salvar gerente
    function salvarGerente($conn, $meta_id, $gerente) {
        if (!$gerente) return;
        
        $sql = "INSERT INTO meta_loja_gerente (id, meta_loja_id, nome, funcao, percentual_meta_geral, valor_vendido_total, esmaltes, profissional_parceiras, valor_vendido_make, quantidade_malka, valor_malka, bijou_make_bolsas) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        
        // Aceitar tanto camelCase quanto snake_case
        $valorVendidoTotal = is_array($gerente) ? ($gerente['valorVendidoTotal'] ?? $gerente['valor_vendido_total'] ?? 0) : ($gerente->valorVendidoTotal ?? $gerente->valor_vendido_total ?? 0);
        $esmaltes = is_array($gerente) ? ($gerente['esmaltes'] ?? 0) : ($gerente->esmaltes ?? 0);
        $profissionalParceiras = is_array($gerente) ? ($gerente['profissionalParceiras'] ?? $gerente['profissional_parceiras'] ?? 0) : ($gerente->profissionalParceiras ?? $gerente->profissional_parceiras ?? 0);
        $valorVendidoMake = is_array($gerente) ? ($gerente['valorVendidoMake'] ?? $gerente['valor_vendido_make'] ?? 0) : ($gerente->valorVendidoMake ?? $gerente->valor_vendido_make ?? 0);
        $quantidadeMalka = is_array($gerente) ? ($gerente['quantidadeMalka'] ?? $gerente['quantidade_malka'] ?? 0) : ($gerente->quantidadeMalka ?? $gerente->quantidade_malka ?? 0);
        $valorMalka = is_array($gerente) ? ($gerente['valorMalka'] ?? $gerente['valor_malka'] ?? 0) : ($gerente->valorMalka ?? $gerente->valor_malka ?? 0);
        $bijouMakeBolsas = is_array($gerente) ? ($gerente['bijouMakeBolsas'] ?? $gerente['bijou_make_bolsas'] ?? 0) : ($gerente->bijouMakeBolsas ?? $gerente->bijou_make_bolsas ?? 0);
        $percentualMetaGeral = is_array($gerente) ? ($gerente['percentualMetaGeral'] ?? $gerente['percentual_meta_geral'] ?? 0) : ($gerente->percentualMetaGeral ?? $gerente->percentual_meta_geral ?? 0);

        $gerente_id = uniqid('gerente_', true);
        $stmt->bindValue(1, $gerente_id);
        $stmt->bindValue(2, $meta_id);
        $stmt->bindValue(3, (is_array($gerente) ? ($gerente['nome'] ?? '') : ($gerente->nome ?? '')));
        $stmt->bindValue(4, (is_array($gerente) ? ($gerente['funcao'] ?? 'GERENTE') : ($gerente->funcao ?? 'GERENTE')));
        $stmt->bindValue(5, is_numeric($percentualMetaGeral) ? (float)$percentualMetaGeral : 0);
        $stmt->bindValue(6, $valorVendidoTotal);
        $stmt->bindValue(7, $esmaltes);
        $stmt->bindValue(8, $profissionalParceiras);
        $stmt->bindValue(9, $valorVendidoMake);
        $stmt->bindValue(10, $quantidadeMalka);
        $stmt->bindValue(11, $valorMalka);
        $stmt->bindValue(12, $bijouMakeBolsas);
        $stmt->execute();
        
        // Salvar metas de produtos do gerente
        if ((is_array($gerente) && isset($gerente['metasProdutos']) && is_array($gerente['metasProdutos'])) || (isset($gerente->metasProdutos) && is_array($gerente->metasProdutos))) {
            $metasProdutos = is_array($gerente) ? $gerente['metasProdutos'] : $gerente->metasProdutos;
            salvarMetasProdutos($conn, $meta_id, $gerente_id, 'gerente', $metasProdutos);
        }
    }

    // Função para salvar campanhas
    function salvarCampanhas($conn, $meta_id, $campanhas) {
        $sql = "INSERT INTO meta_loja_campanhas (id, meta_loja_id, nome, descricao, quantidade_vendida, atingiu_meta) 
                VALUES (?, ?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        
        foreach ($campanhas as $campanha) {
            $campanha_id = uniqid('campanha_', true);
            $stmt->bindValue(1, $campanha_id);
            $stmt->bindValue(2, $meta_id);
            $stmt->bindValue(3, $campanha->nome ?? '');
            $stmt->bindValue(4, $campanha->descricao ?? '');
            // Aceitar tanto camelCase quanto snake_case
            if (is_array($campanha)) {
                $quantidadeVendida = $campanha['quantidadeVendida'] ?? $campanha['quantidade_vendida'] ?? 0;
                $atingiuMeta = $campanha['atingiuMeta'] ?? $campanha['atingiu_meta'] ?? false;
            } else {
                $quantidadeVendida = $campanha->quantidadeVendida ?? $campanha->quantidade_vendida ?? 0;
                $atingiuMeta = $campanha->atingiuMeta ?? $campanha->atingiu_meta ?? false;
            }
            // Preservar decimais ao salvar quantidade_vendida
            $stmt->bindValue(5, (float)$quantidadeVendida);
            $stmt->bindValue(6, $atingiuMeta ? 1 : 0, PDO::PARAM_INT);
            $stmt->execute();
        }
    }

    // Função para salvar funcionários
    function salvarFuncionarios($conn, $meta_id, $funcionarios) {
        $sql = "INSERT INTO meta_loja_funcionarios (id, meta_loja_id, nome, funcao) 
                VALUES (?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        
        foreach ($funcionarios as $funcionario) {
            $funcionario_id = uniqid('funcionario_', true);
            $stmt->bindValue(1, $funcionario_id);
            $stmt->bindValue(2, $meta_id);
            $stmt->bindValue(3, $funcionario->nome ?? '');
            $stmt->bindValue(4, $funcionario->funcao ?? '');
            $stmt->execute();
            
            // Salvar metas de produtos do funcionário
            if (isset($funcionario->metasProdutos) && is_array($funcionario->metasProdutos)) {
                salvarMetasProdutos($conn, $meta_id, $funcionario_id, 'funcionario', $funcionario->metasProdutos);
            }
        }
    }

    // Função para salvar metas de produtos
function salvarMetasProdutos($conn, $meta_id, $funcionario_id, $tipo_funcionario, $metas_produtos) {
    $sql = "INSERT INTO meta_loja_produtos (id, meta_loja_id, funcionario_id, tipo_funcionario, nome_produto_marca, qtd_meta, qtd_vendido, percentual_sobre_venda, valor_vendido, valor_comissao)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    
    foreach ($metas_produtos as $meta_produto) {
        $meta_produto_id = uniqid('meta_produto_', true);
        $stmt->bindValue(1, $meta_produto_id);
        $stmt->bindValue(2, $meta_id);
        $stmt->bindValue(3, $funcionario_id);
        $stmt->bindValue(4, $tipo_funcionario);
        // Mapear nomes dos campos do frontend para backend
        $stmt->bindValue(5, $meta_produto->nomeProdutoMarca ?? $meta_produto->nome_produto_marca ?? '');
        $stmt->bindValue(6, $meta_produto->qtdMeta ?? $meta_produto->qtd_meta ?? 0);
        $stmt->bindValue(7, $meta_produto->qtdVendido ?? $meta_produto->qtd_vendido ?? 0);
        $stmt->bindValue(8, $meta_produto->percentualSobreVenda ?? $meta_produto->percentual_sobre_venda ?? 0);
        $stmt->bindValue(9, $meta_produto->valorVendido ?? $meta_produto->valor_vendido ?? 0);
        $stmt->bindValue(10, $meta_produto->valorComissao ?? $meta_produto->valor_comissao ?? 0);
        $stmt->execute();
    }
}

    // Remover todos os dados antigos das subseções
    removerDadosAntigos($conn, $meta_id);

    // Salvar todas as subseções atualizadas
    if (!empty($operadoras_caixa)) {
        salvarOperadorasCaixa($conn, $meta_id, $operadoras_caixa);
    }
    
    if (!empty($vendedoras)) {
        salvarVendedoras($conn, $meta_id, $vendedoras);
    }
    
    if (!empty($vendedoras_bijou)) {
        salvarVendedorasBijou($conn, $meta_id, $vendedoras_bijou);
    }
    
    if ($gerente) {
        salvarGerente($conn, $meta_id, $gerente);
    }
    
    if (!empty($campanhas)) {
        salvarCampanhas($conn, $meta_id, $campanhas);
    }
    
    if (!empty($funcionarios)) {
        salvarFuncionarios($conn, $meta_id, $funcionarios);
    }

    // Buscar a meta atualizada para retornar
    $sqlSelect = "SELECT 
                    ml.id,
                    ml.loja_id,
                    ml.nome_loja,
                    ml.mes,
                    ml.ano,
                    ml.grupo_meta_id,
                    ml.valor_venda_loja_total,
                    gmp.nome as grupo_meta_nome,
                    gmp.descricao as grupo_meta_descricao,
                    ml.data_criacao,
                    ml.ativo,
                    COUNT(mpg.id) as total_metas_produtos
                  FROM metas_lojas ml
                  LEFT JOIN grupos_metas_produtos gmp ON ml.grupo_meta_id = gmp.id
                  LEFT JOIN metas_produtos_grupo mpg ON gmp.id = mpg.grupo_id
                  WHERE ml.id = ?
                  GROUP BY ml.id";
    $stmtSelect = $conn->prepare($sqlSelect);
    $stmtSelect->bindValue(1, $meta_id);
    $stmtSelect->execute();
    $meta = $stmtSelect->fetch(PDO::FETCH_ASSOC);

    // Função para obter nome do mês
    function getNomeMes($mes) {
        $meses = [
            1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março', 4 => 'Abril',
            5 => 'Maio', 6 => 'Junho', 7 => 'Julho', 8 => 'Agosto',
            9 => 'Setembro', 10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro'
        ];
        return isset($meses[$mes]) ? $meses[$mes] : 'Mês inválido';
    }

    $metaRetorno = [
        'id' => $meta['id'],
        'lojaId' => $meta['loja_id'],
        'nomeLoja' => $meta['nome_loja'],
        'mes' => (int)$meta['mes'],
        'nomeMes' => getNomeMes((int)$meta['mes']),
        'ano' => (int)$meta['ano'],
        'periodo' => getNomeMes((int)$meta['mes']) . '/' . $meta['ano'],
        'grupoMetaId' => $meta['grupo_meta_id'],
        'grupoMetaNome' => $meta['grupo_meta_nome'],
        'grupoMetaDescricao' => $meta['grupo_meta_descricao'],
        'valorVendaLojaTotal' => (float)$meta['valor_venda_loja_total'],
        'totalMetasProdutos' => (int)$meta['total_metas_produtos'],
        'dataCriacao' => $meta['data_criacao'],
        'ativo' => (bool)$meta['ativo']
    ];

    // Confirmar transação
    $conn->commit();

    http_response_code(200);
    echo json_encode([
        "status" => 1,
        "message" => "Meta de loja atualizada com sucesso",
        "data" => $metaRetorno
    ]);

} catch (Exception $e) {
    // Reverter transação em caso de erro
    $conn->rollBack();
    http_response_code(500);
    echo json_encode([
        "status" => 0,
        "message" => "Erro interno do servidor: " . $e->getMessage()
    ]);
}
?>