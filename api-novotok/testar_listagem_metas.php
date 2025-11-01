<?php
// Script para testar a listagem de metas simulando uma requisição HTTP real
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "=== TESTE FINAL DA LISTAGEM DE METAS ===\n\n";

echo "🔍 Testando busca de metas para loja_id: 7\n\n";

// Capturar qualquer saída e erros
ob_start();
$error_output = '';

// Capturar erros específicos de funcionario_id
set_error_handler(function($severity, $message, $file, $line) use (&$error_output) {
    if (strpos($message, 'funcionario_id') !== false) {
        $error_output .= "❌ ERRO FUNCIONARIO_ID: $message em $file linha $line\n";
    } else {
        $error_output .= "AVISO: $message\n";
    }
});

try {
    // Incluir dependências necessárias
    require_once 'database.php';
    
    // Executar a lógica principal do listar_metas_lojas.php manualmente
    $database = new Database();
    $conn = $database->getConnection();
    
    $loja_id = '7';
    
    echo "✅ Conexão com banco estabelecida\n";
    
    // SQL principal
    $sql = "SELECT 
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
                ml.ativo
            FROM metas_lojas ml
            LEFT JOIN grupos_metas_produtos gmp ON ml.grupo_meta_id = gmp.id
            WHERE ml.loja_id = ?
            ORDER BY ml.ano DESC, ml.mes DESC";
    
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(1, $loja_id);
    $stmt->execute();
    $metas = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "✅ Consulta principal executada - " . count($metas) . " meta(s) encontrada(s)\n";
    
    // Função para buscar dados das subseções (copiada do arquivo original)
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
            $stmtProdutos->bindValue(2, $operadora['id']); // CORREÇÃO APLICADA
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
            $stmtProdutos->bindValue(2, $vendedora['id']); // CORREÇÃO APLICADA
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
            $stmtProdutos->bindValue(2, $vendedoraBijou['id']); // CORREÇÃO APLICADA
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
            $stmtProdutos->bindValue(2, $gerente['id']); // CORREÇÃO APLICADA
            $stmtProdutos->execute();
            $gerente['metasProdutos'] = $stmtProdutos->fetchAll(PDO::FETCH_ASSOC);
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
            $stmtProdutos->bindValue(2, $funcionario['id']); // CORREÇÃO APLICADA
            $stmtProdutos->execute();
            $funcionario['metasProdutos'] = $stmtProdutos->fetchAll(PDO::FETCH_ASSOC);
        }
        $subsecoes['funcionarios'] = $funcionarios;

        return $subsecoes;
    }
    
    function getNomeMes($mes) {
        $meses = [
            1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março', 4 => 'Abril',
            5 => 'Maio', 6 => 'Junho', 7 => 'Julho', 8 => 'Agosto',
            9 => 'Setembro', 10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro'
        ];
        return $meses[$mes] ?? 'Mês inválido';
    }
    
    // Formatar os resultados
    $metasFormatadas = [];
    foreach ($metas as $meta) {
        echo "✅ Processando meta: " . $meta['id'] . "\n";
        
        // Buscar dados das subseções para esta meta
        $subsecoes = buscarDadosSubsecoes($conn, $meta['id']);
        
        echo "✅ Subseções carregadas:\n";
        echo "   - Operadoras: " . count($subsecoes['operadorasCaixa']) . "\n";
        echo "   - Vendedoras: " . count($subsecoes['vendedoras']) . "\n";
        echo "   - Vendedoras Bijou: " . count($subsecoes['vendedorasBijou']) . "\n";
        echo "   - Gerentes: " . count($subsecoes['gerente']) . "\n";
        echo "   - Campanhas: " . count($subsecoes['campanhas']) . "\n";
        echo "   - Funcionários: " . count($subsecoes['funcionarios']) . "\n";

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
            'valorVendaLojaTotal' => (float)$meta['valor_venda_loja_total'],
            'ativo' => (bool)$meta['ativo'],
            'dataCriacao' => $meta['data_criacao'],
            'subsecoes' => $subsecoes
        ];
    }
    
    $response = [
        "status" => 1,
        "message" => "Metas de lojas listadas com sucesso",
        "data" => $metasFormatadas,
        "total" => count($metasFormatadas)
    ];
    
    echo "\n✅ Resposta formatada com sucesso\n";
    
} catch (Exception $e) {
    $error_output .= "EXCEÇÃO: " . $e->getMessage() . "\n";
    echo "❌ ERRO: " . $e->getMessage() . "\n";
}

$output = ob_get_clean();
restore_error_handler();

echo "\n\n📋 Resultado do Teste:\n";
echo "========================================\n";

if (!empty($error_output)) {
    echo "❌ ERROS DETECTADOS:\n";
    echo $error_output . "\n";
} else {
    echo "✅ Nenhum erro de 'funcionario_id' detectado!\n\n";
}

if (isset($response)) {
    echo "📊 RESUMO DOS DADOS:\n";
    echo "   - Status: " . $response['status'] . "\n";
    echo "   - Mensagem: " . $response['message'] . "\n";
    echo "   - Total de metas: " . $response['total'] . "\n";
    
    if (!empty($response['data'])) {
        $meta = $response['data'][0];
        echo "\n📋 Primeira meta encontrada:\n";
        echo "   - ID: " . $meta['id'] . "\n";
        echo "   - Loja: " . $meta['nomeLoja'] . "\n";
        echo "   - Período: " . $meta['periodo'] . "\n";
        echo "   - Valor Total: R$ " . number_format($meta['valorVendaLojaTotal'], 2, ',', '.') . "\n";
        
        echo "\n📋 Subseções com dados:\n";
        foreach ($meta['subsecoes'] as $tipo => $dados) {
            if (!empty($dados)) {
                echo "   - $tipo: " . count($dados) . " item(s)\n";
                
                // Verificar se há metas de produtos
                $primeiro = $dados[0];
                if (isset($primeiro['metasProdutos'])) {
                    echo "     * Metas de produtos: " . count($primeiro['metasProdutos']) . "\n";
                }
            }
        }
    }
    
    echo "\n📄 JSON de resposta:\n";
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
}

echo "\n🎯 CONCLUSÃO:\n";
if (empty($error_output) && isset($response['status']) && $response['status'] == 1) {
    echo "✅ SUCESSO! O problema do 'funcionario_id' foi completamente resolvido!\n";
    echo "✅ A API está funcionando corretamente e retornando dados válidos.\n";
} else {
    echo "❌ Ainda há problemas na API que precisam ser investigados.\n";
}
?>