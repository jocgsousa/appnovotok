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
    $usuario_id = $payload->id;
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

try {
    // Parâmetros de filtro opcionais
    $funcionario_id = isset($_GET['funcionario_id']) ? trim($_GET['funcionario_id']) : '';
    $tipo_funcionario = isset($_GET['tipo_funcionario']) ? trim($_GET['tipo_funcionario']) : '';
    $mes = isset($_GET['mes']) ? (int)$_GET['mes'] : null;
    $ano = isset($_GET['ano']) ? (int)$_GET['ano'] : null;
    $ativo = isset($_GET['ativo']) ? $_GET['ativo'] : '';
    $busca = isset($_GET['busca']) ? trim($_GET['busca']) : '';

    // Construir a consulta SQL base
    $sql = "SELECT 
                mpf.id,
                mpf.funcionario_id,
                mpf.nome_funcionario,
                mpf.tipo_funcionario,
                mpf.nome_produto_marca,
                mpf.qtd_meta,
                mpf.percentual_sobre_venda,
                mpf.mes,
                mpf.ano,
                mpf.data_criacao,
                mpf.ativo
            FROM metas_produtos_funcionarios mpf
            WHERE 1=1";

    $params = [];
    $paramIndex = 1;

    // Aplicar filtros
    if (!empty($funcionario_id)) {
        $sql .= " AND mpf.funcionario_id = ?";
        $params[$paramIndex++] = $funcionario_id;
    }

    if (!empty($tipo_funcionario)) {
        $validTipos = ['operadora_caixa', 'vendedora', 'vendedora_bijou', 'gerente'];
        if (in_array($tipo_funcionario, $validTipos)) {
            $sql .= " AND mpf.tipo_funcionario = ?";
            $params[$paramIndex++] = $tipo_funcionario;
        }
    }

    if ($mes !== null && $mes >= 1 && $mes <= 12) {
        $sql .= " AND mpf.mes = ?";
        $params[$paramIndex++] = $mes;
    }

    if ($ano !== null && $ano >= 2020) {
        $sql .= " AND mpf.ano = ?";
        $params[$paramIndex++] = $ano;
    }

    if ($ativo !== '') {
        $sql .= " AND mpf.ativo = ?";
        $params[$paramIndex++] = $ativo === 'true' ? 1 : 0;
    }

    if (!empty($busca)) {
        $sql .= " AND (mpf.nome_funcionario LIKE ? OR mpf.nome_produto_marca LIKE ?)";
        $buscaParam = '%' . $busca . '%';
        $params[$paramIndex++] = $buscaParam;
        $params[$paramIndex++] = $buscaParam;
    }

    $sql .= " ORDER BY mpf.ano DESC, mpf.mes DESC, mpf.nome_funcionario ASC, mpf.nome_produto_marca ASC";

    $stmt = $conn->prepare($sql);

    // Bind dos parâmetros
    foreach ($params as $index => $value) {
        $stmt->bindValue($index, $value);
    }

    $stmt->execute();
    $metas = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Função para obter nome do mês
    function getNomeMes($mes) {
        $meses = [
            1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março', 4 => 'Abril',
            5 => 'Maio', 6 => 'Junho', 7 => 'Julho', 8 => 'Agosto',
            9 => 'Setembro', 10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro'
        ];
        return isset($meses[$mes]) ? $meses[$mes] : 'Mês inválido';
    }

    // Função para obter nome do tipo de funcionário
    function getNomeTipoFuncionario($tipo) {
        $tipos = [
            'operadora_caixa' => 'Operadora de Caixa',
            'vendedora' => 'Vendedora',
            'vendedora_bijou' => 'Vendedora Bijou',
            'gerente' => 'Gerente'
        ];
        return isset($tipos[$tipo]) ? $tipos[$tipo] : $tipo;
    }

    // Formatar os resultados
    $metasFormatadas = [];
    foreach ($metas as $meta) {
        $metasFormatadas[] = [
            'id' => $meta['id'],
            'funcionarioId' => $meta['funcionario_id'],
            'nomeFuncionario' => $meta['nome_funcionario'],
            'tipoFuncionario' => $meta['tipo_funcionario'],
            'tipoFuncionarioNome' => getNomeTipoFuncionario($meta['tipo_funcionario']),
            'nomeProdutoMarca' => $meta['nome_produto_marca'],
            'qtdMeta' => (int)$meta['qtd_meta'],
            'percentualSobreVenda' => (float)$meta['percentual_sobre_venda'],
            'mes' => (int)$meta['mes'],
            'nomeMes' => getNomeMes((int)$meta['mes']),
            'ano' => (int)$meta['ano'],
            'periodo' => getNomeMes((int)$meta['mes']) . '/' . $meta['ano'],
            'dataCriacao' => $meta['data_criacao'],
            'ativo' => (bool)$meta['ativo']
        ];
    }

    http_response_code(200);
    echo json_encode([
        "status" => 1,
        "message" => "Metas de produtos de funcionários listadas com sucesso",
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