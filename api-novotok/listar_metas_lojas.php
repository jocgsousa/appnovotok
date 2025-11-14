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
    $usuario_id = isset($payload->data->user_id) ? $payload->data->user_id : null;
    
    if (!$usuario_id) {
        throw new Exception("ID do usuário não encontrado no token");
    }
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token inválido: " . $e->getMessage()
    ]);
    exit;
}

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

// Obter tipo de usuário e possível filial associada
$is_admin = false;
$usuario_filial_id = null;
try {
    // Buscar tipo de usuário
    $stmtTipo = $conn->prepare("SELECT tipo_usuario FROM usuarios WHERE id = ? LIMIT 1");
    $stmtTipo->bindValue(1, $usuario_id);
    $stmtTipo->execute();
    $rowTipo = $stmtTipo->fetch(PDO::FETCH_ASSOC);
    $tipoUsuario = isset($rowTipo['tipo_usuario']) ? strtolower($rowTipo['tipo_usuario']) : null;
    $is_admin = ($tipoUsuario === 'admin');

    // Verificar se a coluna filial_id existe e obter valor
    $stmtCheck = $conn->query("SHOW COLUMNS FROM usuarios LIKE 'filial_id'");
    if ($stmtCheck && $stmtCheck->rowCount() > 0) {
        $stmtFilial = $conn->prepare("SELECT filial_id FROM usuarios WHERE id = ? LIMIT 1");
        $stmtFilial->bindValue(1, $usuario_id);
        $stmtFilial->execute();
        $rowFilial = $stmtFilial->fetch(PDO::FETCH_ASSOC);
        if ($rowFilial && isset($rowFilial['filial_id'])) {
            $usuario_filial_id = (string)$rowFilial['filial_id'];
        }
    }
} catch (Exception $e) {
    // Ignorar falhas ao obter tipo/filial; seguirá sem restrição adicional
}

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
    // Parâmetros de filtro opcionais
    $loja_id = isset($_GET['loja_id']) ? trim($_GET['loja_id']) : '';
    $mes = isset($_GET['mes']) ? intval($_GET['mes']) : null;
    $ano = isset($_GET['ano']) ? intval($_GET['ano']) : null;
    $ativo = isset($_GET['ativo']) ? $_GET['ativo'] : '';
    $busca = isset($_GET['busca']) ? trim($_GET['busca']) : '';

    // Enforce: usuários não-admin só podem ver sua própria filial
    if (!$is_admin && !empty($usuario_filial_id)) {
        $loja_id = $usuario_filial_id; // sobrescreve qualquer loja_id passado
    }

    // Construir a consulta SQL base
    $sql = "SELECT 
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
            WHERE 1=1";

    $params = [];
    $paramIndex = 1;

    // Aplicar filtros
    if (!empty($loja_id)) {
        $sql .= " AND ml.loja_id = ?";
        $params[$paramIndex++] = $loja_id;
    }

    if ($mes !== null && $mes > 0 && $mes <= 12) {
        $sql .= " AND ml.mes = ?";
        $params[$paramIndex++] = $mes;
    }

    if ($ano !== null && $ano > 0) {
        $sql .= " AND ml.ano = ?";
        $params[$paramIndex++] = $ano;
    }

    if ($ativo !== '') {
        $sql .= " AND ml.ativo = ?";
        $params[$paramIndex++] = $ativo === 'true' ? 1 : 0;
    }

    if (!empty($busca)) {
        $sql .= " AND (ml.nome_loja LIKE ? OR gm.nome LIKE ?)";
        $buscaParam = '%' . $busca . '%';
        $params[$paramIndex++] = $buscaParam;
        $params[$paramIndex++] = $buscaParam;
    }

    $sql .= " ORDER BY ml.ano DESC, ml.mes DESC, ml.nome_loja ASC";

    $stmt = $conn->prepare($sql);

    // Bind dos parâmetros
    foreach ($params as $index => $value) {
        $stmt->bindValue($index, $value);
    }

    $stmt->execute();
    $metas = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Função para buscar dados das subseções
    function buscarDadosSubsecoes($conn, $metaLojaId) {
        $subsecoes = [];

        // 1. Operadoras de Caixa
        $stmt = $conn->prepare("SELECT * FROM meta_loja_operadoras_caixa WHERE meta_loja_id = ?");
        $stmt->bindValue(1, $metaLojaId);
        $stmt->execute();
        $operadoras = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($operadoras as &$operadora) {
            // Buscar metas de produtos para esta operadora
            $stmtProdutos = $conn->prepare("SELECT * FROM meta_loja_produtos WHERE meta_loja_id = ? AND funcionario_id = ? AND tipo_funcionario = 'operadora_caixa'");
            $stmtProdutos->bindValue(1, $metaLojaId);
            $stmtProdutos->bindValue(2, $operadora['id']);
            $stmtProdutos->execute();
            $operadora['metasProdutos'] = $stmtProdutos->fetchAll(PDO::FETCH_ASSOC);
        }
        $subsecoes['operadorasCaixa'] = $operadoras;

        // 2. Vendedoras
        $stmt = $conn->prepare("SELECT * FROM meta_loja_vendedoras WHERE meta_loja_id = ?");
        $stmt->bindValue(1, $metaLojaId);
        $stmt->execute();
        $vendedoras = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($vendedoras as &$vendedora) {
            // Buscar metas de produtos para esta vendedora
            $stmtProdutos = $conn->prepare("SELECT * FROM meta_loja_produtos WHERE meta_loja_id = ? AND funcionario_id = ? AND tipo_funcionario = 'vendedora'");
            $stmtProdutos->bindValue(1, $metaLojaId);
            $stmtProdutos->bindValue(2, $vendedora['id']);
            $stmtProdutos->execute();
            $vendedora['metasProdutos'] = $stmtProdutos->fetchAll(PDO::FETCH_ASSOC);
        }
        $subsecoes['vendedoras'] = $vendedoras;

        // 3. Vendedoras Bijou
        $stmt = $conn->prepare("SELECT * FROM meta_loja_vendedoras_bijou WHERE meta_loja_id = ?");
        $stmt->bindValue(1, $metaLojaId);
        $stmt->execute();
        $vendedorasBijou = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($vendedorasBijou as &$vendedoraBijou) {
            // Buscar metas de produtos para esta vendedora bijou
            $stmtProdutos = $conn->prepare("SELECT * FROM meta_loja_produtos WHERE meta_loja_id = ? AND funcionario_id = ? AND tipo_funcionario = 'vendedora_bijou'");
            $stmtProdutos->bindValue(1, $metaLojaId);
            $stmtProdutos->bindValue(2, $vendedoraBijou['id']);
            $stmtProdutos->execute();
            $vendedoraBijou['metasProdutos'] = $stmtProdutos->fetchAll(PDO::FETCH_ASSOC);
        }
        $subsecoes['vendedorasBijou'] = $vendedorasBijou;

        // 4. Gerente
        $stmt = $conn->prepare("SELECT * FROM meta_loja_gerente WHERE meta_loja_id = ?");
        $stmt->bindValue(1, $metaLojaId);
        $stmt->execute();
        $gerentes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($gerentes as &$gerente) {
            // Buscar metas de produtos para este gerente
            $stmtProdutos = $conn->prepare("SELECT * FROM meta_loja_produtos WHERE meta_loja_id = ? AND funcionario_id = ? AND tipo_funcionario = 'gerente'");
            $stmtProdutos->bindValue(1, $metaLojaId);
            $stmtProdutos->bindValue(2, $gerente['id']);
            $stmtProdutos->execute();
            $gerente['metasProdutos'] = $stmtProdutos->fetchAll(PDO::FETCH_ASSOC);

            // Normalizar percentual para fracionário: legado >1 vira /100 (ex.: 9 => 0.09)
            if (isset($gerente['percentual_meta_geral'])) {
                $p = (float)$gerente['percentual_meta_geral'];
                $gerente['percentualMetaGeral'] = ($p > 1 ? $p / 100 : $p);
            }
        }
        $subsecoes['gerente'] = $gerentes;

        // 5. Campanhas
        $stmt = $conn->prepare("SELECT * FROM meta_loja_campanhas WHERE meta_loja_id = ?");
        $stmt->bindValue(1, $metaLojaId);
        $stmt->execute();
        $subsecoes['campanhas'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 6. Funcionários (outros)
        $stmt = $conn->prepare("SELECT * FROM meta_loja_funcionarios WHERE meta_loja_id = ?");
        $stmt->bindValue(1, $metaLojaId);
        $stmt->execute();
        $funcionarios = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($funcionarios as &$funcionario) {
            // Buscar metas de produtos para este funcionário
            $stmtProdutos = $conn->prepare("SELECT * FROM meta_loja_produtos WHERE meta_loja_id = ? AND funcionario_id = ? AND tipo_funcionario = 'funcionario'");
            $stmtProdutos->bindValue(1, $metaLojaId);
            $stmtProdutos->bindValue(2, $funcionario['id']);
            $stmtProdutos->execute();
            $funcionario['metasProdutos'] = $stmtProdutos->fetchAll(PDO::FETCH_ASSOC);
        }
        $subsecoes['funcionarios'] = $funcionarios;

        return $subsecoes;
    }

    // Formatar os resultados
    $metasFormatadas = [];
    foreach ($metas as $meta) {
        // Buscar dados das subseções para esta meta
        $subsecoes = buscarDadosSubsecoes($conn, $meta['id']);

        $metasFormatadas[] = [
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
            // Garantir retorno numérico mesmo quando for 0 ou vazio
            'valorVendaLojaTotal' => is_numeric($meta['valor_venda_loja_total']) ? (float)$meta['valor_venda_loja_total'] : 0.0,
            'ativo' => (bool)$meta['ativo'],
            'dataCriacao' => $meta['data_criacao'],
            'subsecoes' => $subsecoes
        ];
    }

    http_response_code(200);
    echo json_encode([
        "status" => 1,
        "message" => "Metas de lojas listadas com sucesso",
        "data" => $metasFormatadas,
        "total" => count($metasFormatadas)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => 0,
        "message" => "Erro interno do servidor: " . $e->getMessage()
    ]);
}
?>