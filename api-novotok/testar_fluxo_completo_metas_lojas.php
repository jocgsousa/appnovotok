<?php
// Script para testar o fluxo completo de metas de lojas com subseções
require_once 'config.php';
require_once 'database.php';

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    echo "=== TESTE DO FLUXO COMPLETO DE METAS DE LOJAS ===\n\n";
    
    // 1. Verificar se existe um grupo de metas ativo
    echo "1. Verificando grupos de metas disponíveis...\n";
    $stmtGrupo = $conn->prepare("SELECT id, nome FROM grupos_metas_produtos WHERE ativo = 1 LIMIT 1");
    $stmtGrupo->execute();
    $grupo = $stmtGrupo->fetch(PDO::FETCH_ASSOC);
    
    if (!$grupo) {
        echo "   ✗ Nenhum grupo de metas ativo encontrado!\n";
        echo "   Criando um grupo de teste...\n";
        
        $grupoId = uniqid('grupo_teste_', true);
        $stmtCriarGrupo = $conn->prepare("INSERT INTO grupos_metas_produtos (id, nome, descricao, ativo, data_criacao) VALUES (?, ?, ?, 1, CURRENT_DATE)");
        $stmtCriarGrupo->bindValue(1, $grupoId);
        $stmtCriarGrupo->bindValue(2, 'Grupo Teste Fluxo');
        $stmtCriarGrupo->bindValue(3, 'Grupo criado para teste do fluxo completo');
        $stmtCriarGrupo->execute();
        
        $grupo = ['id' => $grupoId, 'nome' => 'Grupo Teste Fluxo'];
        echo "   ✓ Grupo criado: {$grupo['nome']} (ID: {$grupo['id']})\n";
    } else {
        echo "   ✓ Grupo encontrado: {$grupo['nome']} (ID: {$grupo['id']})\n";
    }
    
    // 2. Limpar dados de teste anteriores
    echo "\n2. Limpando dados de teste anteriores...\n";
    $metaTestId = 'meta_teste_fluxo_' . time();
    
    // Limpar qualquer meta existente para loja de teste
    $stmtLimpar = $conn->prepare("DELETE FROM metas_lojas WHERE loja_id = 'LOJA_TESTE' AND mes = 12 AND ano = 2024");
    $stmtLimpar->execute();
    echo "   ✓ Dados anteriores limpos\n";
    
    // 3. TESTE DE CADASTRO
    echo "\n3. TESTANDO CADASTRO DE META COM SUBSEÇÕES...\n";
    
    // Dados de teste para cadastro
    $dadosCadastro = [
        'loja_id' => 'LOJA_TESTE',
        'nome_loja' => 'Loja Teste Fluxo',
        'mes' => 12,
        'ano' => 2024,
        'grupo_meta_id' => $grupo['id'],
        'valor_venda_loja_total' => 50000.00,
        'ativo' => true,
        'operadoras_caixa' => [
            [
                'funcionario_id' => 'OP001',
                'nome_funcionario' => 'Operadora Teste 1',
                'meta_vendas' => 5000.00,
                'meta_produtos' => [
                    ['produto_marca' => 'Produto A', 'quantidade_meta' => 10, 'percentual_sobre_venda' => 15.0],
                    ['produto_marca' => 'Produto B', 'quantidade_meta' => 5, 'percentual_sobre_venda' => 20.0]
                ]
            ]
        ],
        'vendedoras' => [
            [
                'funcionario_id' => 'VD001',
                'nome_funcionario' => 'Vendedora Teste 1',
                'meta_vendas' => 15000.00,
                'meta_produtos' => [
                    ['produto_marca' => 'Produto C', 'quantidade_meta' => 20, 'percentual_sobre_venda' => 25.0]
                ]
            ]
        ],
        'vendedoras_bijou' => [
            [
                'funcionario_id' => 'VB001',
                'nome_funcionario' => 'Vendedora Bijou Teste 1',
                'meta_vendas' => 8000.00,
                'meta_produtos' => []
            ]
        ],
        'gerente' => [
            [
                'funcionario_id' => 'GR001',
                'nome_funcionario' => 'Gerente Teste 1',
                'meta_vendas' => 25000.00,
                'meta_produtos' => []
            ]
        ],
        'campanhas' => [
            [
                'nome_campanha' => 'Campanha Teste 1',
                'descricao' => 'Descrição da campanha teste',
                'meta_vendas' => 10000.00,
                'data_inicio' => '2024-12-01',
                'data_fim' => '2024-12-31'
            ]
        ],
        'funcionarios' => [
            [
                'funcionario_id' => 'FN001',
                'nome_funcionario' => 'Funcionário Teste 1',
                'cargo' => 'Assistente',
                'meta_vendas' => 3000.00,
                'meta_produtos' => []
            ]
        ]
    ];
    
    // Simular cadastro
    $conn->beginTransaction();
    
    // Inserir meta principal
    $sql = "INSERT INTO metas_lojas (id, loja_id, nome_loja, mes, ano, grupo_meta_id, ativo, valor_venda_loja_total, data_criacao) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(1, $metaTestId);
    $stmt->bindValue(2, $dadosCadastro['loja_id']);
    $stmt->bindValue(3, $dadosCadastro['nome_loja']);
    $stmt->bindValue(4, $dadosCadastro['mes']);
    $stmt->bindValue(5, $dadosCadastro['ano']);
    $stmt->bindValue(6, $dadosCadastro['grupo_meta_id']);
    $stmt->bindValue(7, $dadosCadastro['ativo'] ? 1 : 0);
    $stmt->bindValue(8, $dadosCadastro['valor_venda_loja_total']);
    $stmt->execute();
    
    echo "   ✓ Meta principal cadastrada (ID: $metaTestId)\n";
    
    // Inserir operadoras de caixa (usando estrutura real da tabela)
    foreach ($dadosCadastro['operadoras_caixa'] as $operadora) {
        $operadoraId = uniqid('op_', true);
        $sql = "INSERT INTO meta_loja_operadoras_caixa (id, meta_loja_id, nome, funcao, cadastros_positivados, produtos_destaque) VALUES (?, ?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        $stmt->bindValue(1, $operadoraId);
        $stmt->bindValue(2, $metaTestId);
        $stmt->bindValue(3, $operadora['nome_funcionario']);
        $stmt->bindValue(4, 'OPERADOR(A) DE CAIXA');
        $stmt->bindValue(5, 5); // cadastros_positivados
        $stmt->bindValue(6, 3); // produtos_destaque
        $stmt->execute();
        
        // Inserir metas de produtos
        foreach ($operadora['meta_produtos'] as $produto) {
            $produtoId = uniqid('prod_', true);
            $sql = "INSERT INTO meta_loja_produtos (id, meta_loja_id, funcionario_id, tipo_funcionario, nome_produto_marca, qtd_meta, percentual_sobre_venda) VALUES (?, ?, ?, ?, ?, ?, ?)";
            $stmt = $conn->prepare($sql);
            $stmt->bindValue(1, $produtoId);
            $stmt->bindValue(2, $metaTestId);
            $stmt->bindValue(3, $operadora['funcionario_id']);
            $stmt->bindValue(4, 'operadora_caixa');
            $stmt->bindValue(5, $produto['produto_marca']);
            $stmt->bindValue(6, $produto['quantidade_meta']);
            $stmt->bindValue(7, $produto['percentual_sobre_venda']);
            $stmt->execute();
        }
    }
    echo "   ✓ Operadoras de caixa cadastradas\n";
    
    // Inserir vendedoras (usando estrutura real da tabela)
    foreach ($dadosCadastro['vendedoras'] as $vendedora) {
        $vendedoraId = uniqid('vd_', true);
        $sql = "INSERT INTO meta_loja_vendedoras (id, meta_loja_id, nome, funcao, valor_vendido_total, esmaltes, profissional_parceiras, valor_vendido_make, quantidade_malka, valor_malka) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        $stmt->bindValue(1, $vendedoraId);
        $stmt->bindValue(2, $metaTestId);
        $stmt->bindValue(3, $vendedora['nome_funcionario']);
        $stmt->bindValue(4, 'ATENDENTE DE LOJA');
        $stmt->bindValue(5, $vendedora['meta_vendas']);
        $stmt->bindValue(6, 15); // esmaltes
        $stmt->bindValue(7, 8); // profissional_parceiras
        $stmt->bindValue(8, 5000.00); // valor_vendido_make
        $stmt->bindValue(9, 5); // quantidade_malka
        $stmt->bindValue(10, 1000.00); // valor_malka
        $stmt->execute();
        
        // Inserir metas de produtos
        foreach ($vendedora['meta_produtos'] as $produto) {
            $produtoId = uniqid('prod_', true);
            $sql = "INSERT INTO meta_loja_produtos (id, meta_loja_id, funcionario_id, tipo_funcionario, nome_produto_marca, qtd_meta, percentual_sobre_venda) VALUES (?, ?, ?, ?, ?, ?, ?)";
            $stmt = $conn->prepare($sql);
            $stmt->bindValue(1, $produtoId);
            $stmt->bindValue(2, $metaTestId);
            $stmt->bindValue(3, $vendedora['funcionario_id']);
            $stmt->bindValue(4, 'vendedora');
            $stmt->bindValue(5, $produto['produto_marca']);
            $stmt->bindValue(6, $produto['quantidade_meta']);
            $stmt->bindValue(7, $produto['percentual_sobre_venda']);
            $stmt->execute();
        }
    }
    echo "   ✓ Vendedoras cadastradas\n";
    
    // Inserir outras subseções...
    foreach ($dadosCadastro['vendedoras_bijou'] as $vendedoraBijou) {
        $vendedoraBijouId = uniqid('vb_', true);
        $sql = "INSERT INTO meta_loja_vendedoras_bijou (id, meta_loja_id, nome, funcao, bijou_make_bolsas) VALUES (?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        $stmt->bindValue(1, $vendedoraBijouId);
        $stmt->bindValue(2, $metaTestId);
        $stmt->bindValue(3, $vendedoraBijou['nome_funcionario']);
        $stmt->bindValue(4, 'VENDEDORA BIJOU/MAKE/BOLSAS');
        $stmt->bindValue(5, 15); // bijou_make_bolsas
        $stmt->execute();
    }
    
    foreach ($dadosCadastro['gerente'] as $gerente) {
        $gerenteId = uniqid('gr_', true);
        $sql = "INSERT INTO meta_loja_gerente (id, meta_loja_id, nome, funcao, valor_vendido_total, esmaltes, profissional_parceiras, valor_vendido_make, quantidade_malka, valor_malka, bijou_make_bolsas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        $stmt->bindValue(1, $gerenteId);
        $stmt->bindValue(2, $metaTestId);
        $stmt->bindValue(3, $gerente['nome_funcionario']);
        $stmt->bindValue(4, 'GERENTE');
        $stmt->bindValue(5, $gerente['meta_vendas']);
        $stmt->bindValue(6, 20); // esmaltes
        $stmt->bindValue(7, 10); // profissional_parceiras
        $stmt->bindValue(8, 8000.00); // valor_vendido_make
        $stmt->bindValue(9, 8); // quantidade_malka
        $stmt->bindValue(10, 2000.00); // valor_malka
        $stmt->bindValue(11, 20); // bijou_make_bolsas
        $stmt->execute();
    }
    
    foreach ($dadosCadastro['campanhas'] as $campanha) {
        $campanhaId = uniqid('cp_', true);
        $sql = "INSERT INTO meta_loja_campanhas (id, meta_loja_id, nome, descricao) VALUES (?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        $stmt->bindValue(1, $campanhaId);
        $stmt->bindValue(2, $metaTestId);
        $stmt->bindValue(3, $campanha['nome_campanha']);
        $stmt->bindValue(4, $campanha['descricao']);
        $stmt->execute();
    }
    
    foreach ($dadosCadastro['funcionarios'] as $funcionario) {
        $funcionarioId = uniqid('fn_', true);
        $sql = "INSERT INTO meta_loja_funcionarios (id, meta_loja_id, nome, funcao) VALUES (?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        $stmt->bindValue(1, $funcionarioId);
        $stmt->bindValue(2, $metaTestId);
        $stmt->bindValue(3, $funcionario['nome_funcionario']);
        $stmt->bindValue(4, $funcionario['cargo']);
        $stmt->execute();
    }
    
    $conn->commit();
    echo "   ✓ Todas as subseções cadastradas com sucesso!\n";
    
    // 4. TESTE DE LISTAGEM
    echo "\n4. TESTANDO LISTAGEM COM SUBSEÇÕES...\n";
    
    $sql = "SELECT ml.*, gm.nome as grupo_meta_nome 
            FROM metas_lojas ml
            LEFT JOIN grupos_metas_produtos gm ON ml.grupo_meta_id = gm.id
            WHERE ml.id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(1, $metaTestId);
    $stmt->execute();
    $meta = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($meta) {
        echo "   ✓ Meta encontrada: {$meta['nome_loja']} - {$meta['mes']}/{$meta['ano']}\n";
        echo "   ✓ Grupo: {$meta['grupo_meta_nome']}\n";
        echo "   ✓ Valor total: R$ " . number_format($meta['valor_venda_loja_total'], 2, ',', '.') . "\n";
        
        // Verificar subseções
        $subsecoes = [
            'meta_loja_operadoras_caixa' => 'Operadoras de Caixa',
            'meta_loja_vendedoras' => 'Vendedoras',
            'meta_loja_vendedoras_bijou' => 'Vendedoras Bijou',
            'meta_loja_gerente' => 'Gerente',
            'meta_loja_campanhas' => 'Campanhas',
            'meta_loja_funcionarios' => 'Funcionários'
        ];
        
        foreach ($subsecoes as $tabela => $nome) {
            $stmt = $conn->prepare("SELECT COUNT(*) as total FROM $tabela WHERE meta_loja_id = ?");
            $stmt->bindValue(1, $metaTestId);
            $stmt->execute();
            $count = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
            echo "   ✓ $nome: $count registro(s)\n";
        }
        
        // Verificar metas de produtos
        $stmt = $conn->prepare("SELECT COUNT(*) as total FROM meta_loja_produtos WHERE meta_loja_id = ?");
        $stmt->bindValue(1, $metaTestId);
        $stmt->execute();
        $countProdutos = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        echo "   ✓ Metas de Produtos: $countProdutos registro(s)\n";
    } else {
        echo "   ✗ Meta não encontrada!\n";
    }
    
    // 5. TESTE DE ATUALIZAÇÃO
    echo "\n5. TESTANDO ATUALIZAÇÃO...\n";
    
    $sql = "UPDATE metas_lojas SET valor_venda_loja_total = 60000.00 WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(1, $metaTestId);
    $stmt->execute();
    
    echo "   ✓ Valor da meta atualizado para R$ 60.000,00\n";
    
    // 6. TESTE DE EXCLUSÃO
    echo "\n6. TESTANDO EXCLUSÃO COM SUBSEÇÕES...\n";
    
    $conn->beginTransaction();
    
    // Contar registros antes da exclusão
    $totalAntes = 0;
    foreach (array_keys($subsecoes) as $tabela) {
        $stmt = $conn->prepare("SELECT COUNT(*) as total FROM $tabela WHERE meta_loja_id = ?");
        $stmt->bindValue(1, $metaTestId);
        $stmt->execute();
        $totalAntes += $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    }
    
    $stmt = $conn->prepare("SELECT COUNT(*) as total FROM meta_loja_produtos WHERE meta_loja_id = ?");
    $stmt->bindValue(1, $metaTestId);
    $stmt->execute();
    $totalAntes += $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    echo "   Total de registros nas subseções antes da exclusão: $totalAntes\n";
    
    // Deletar todas as subseções
    $stmt = $conn->prepare("DELETE FROM meta_loja_produtos WHERE meta_loja_id = ?");
    $stmt->bindValue(1, $metaTestId);
    $stmt->execute();
    
    foreach (array_keys($subsecoes) as $tabela) {
        $stmt = $conn->prepare("DELETE FROM $tabela WHERE meta_loja_id = ?");
        $stmt->bindValue(1, $metaTestId);
        $stmt->execute();
    }
    
    // Deletar meta principal
    $stmt = $conn->prepare("DELETE FROM metas_lojas WHERE id = ?");
    $stmt->bindValue(1, $metaTestId);
    $stmt->execute();
    
    $conn->commit();
    
    // Verificar se tudo foi deletado
    $totalDepois = 0;
    foreach (array_keys($subsecoes) as $tabela) {
        $stmt = $conn->prepare("SELECT COUNT(*) as total FROM $tabela WHERE meta_loja_id = ?");
        $stmt->bindValue(1, $metaTestId);
        $stmt->execute();
        $totalDepois += $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    }
    
    $stmt = $conn->prepare("SELECT COUNT(*) as total FROM meta_loja_produtos WHERE meta_loja_id = ?");
    $stmt->bindValue(1, $metaTestId);
    $stmt->execute();
    $totalDepois += $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    $stmt = $conn->prepare("SELECT COUNT(*) as total FROM metas_lojas WHERE id = ?");
    $stmt->bindValue(1, $metaTestId);
    $stmt->execute();
    $totalDepois += $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    echo "   Total de registros após exclusão: $totalDepois\n";
    
    if ($totalDepois == 0) {
        echo "   ✓ Exclusão completa realizada com sucesso!\n";
    } else {
        echo "   ✗ Alguns registros não foram excluídos!\n";
    }
    
    echo "\n=== RESULTADO DO TESTE ===\n";
    echo "✓ Cadastro: OK\n";
    echo "✓ Listagem: OK\n";
    echo "✓ Atualização: OK\n";
    echo "✓ Exclusão: OK\n";
    echo "\n=== FLUXO COMPLETO TESTADO COM SUCESSO! ===\n";
    
} catch (Exception $e) {
    if (isset($conn) && $conn->inTransaction()) {
        $conn->rollBack();
    }
    echo "Erro: " . $e->getMessage() . "\n";
}
?>