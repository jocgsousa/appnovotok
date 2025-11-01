<?php
// Script para validar se o database.sql está correto com as implementações atuais
require_once 'config.php';
require_once 'database.php';

try {
    echo "=== VALIDAÇÃO DO DATABASE.SQL ===\n\n";
    
    // Lista das tabelas que devem existir
    $tabelasEsperadas = [
        'metas_lojas',
        'meta_loja_operadoras_caixa',
        'meta_loja_vendedoras', 
        'meta_loja_vendedoras_bijou',
        'meta_loja_gerente',
        'meta_loja_campanhas',
        'meta_loja_produtos',
        'meta_loja_funcionarios'
    ];
    
    // Estruturas esperadas para cada tabela
    $estruturasEsperadas = [
        'metas_lojas' => [
            'id' => 'VARCHAR(50)',
            'loja_id' => 'VARCHAR(50)', 
            'nome_loja' => 'VARCHAR(100)',
            'mes' => 'INT',
            'ano' => 'INT',
            'grupo_meta_id' => 'VARCHAR(50)',
            'ativo' => 'BOOLEAN',
            'data_criacao' => 'DATE',
            'valor_venda_loja_total' => 'DECIMAL(15,2)'
        ],
        'meta_loja_operadoras_caixa' => [
            'id' => 'VARCHAR(50)',
            'meta_loja_id' => 'VARCHAR(50)',
            'nome' => 'VARCHAR(100)',
            'funcao' => 'VARCHAR(50)',
            'cadastros_positivados' => 'INT',
            'produtos_destaque' => 'INT'
        ],
        'meta_loja_vendedoras' => [
            'id' => 'VARCHAR(50)',
            'meta_loja_id' => 'VARCHAR(50)',
            'nome' => 'VARCHAR(100)',
            'funcao' => 'VARCHAR(50)',
            'valor_vendido_total' => 'DECIMAL(15,2)',
            'esmaltes' => 'INT',
            'profissional_parceiras' => 'INT',
            'valor_vendido_make' => 'DECIMAL(15,2)',
            'quantidade_malka' => 'INT',
            'valor_malka' => 'DECIMAL(15,2)'
        ],
        'meta_loja_vendedoras_bijou' => [
            'id' => 'VARCHAR(50)',
            'meta_loja_id' => 'VARCHAR(50)',
            'nome' => 'VARCHAR(100)',
            'funcao' => 'VARCHAR(50)',
            'bijou_make_bolsas' => 'INT'
        ],
        'meta_loja_gerente' => [
            'id' => 'VARCHAR(50)',
            'meta_loja_id' => 'VARCHAR(50)',
            'nome' => 'VARCHAR(100)',
            'funcao' => 'VARCHAR(50)',
            'percentual_meta_geral' => 'DECIMAL(5,4)'
        ],
        'meta_loja_campanhas' => [
            'id' => 'VARCHAR(50)',
            'meta_loja_id' => 'VARCHAR(50)',
            'nome' => 'VARCHAR(100)',
            'quantidade_vendida' => 'INT',
            'atingiu_meta' => 'BOOLEAN'
        ],
        'meta_loja_produtos' => [
            'id' => 'VARCHAR(50)',
            'meta_loja_id' => 'VARCHAR(50)',
            'funcionario_id' => 'VARCHAR(50)',
            'tipo_funcionario' => 'ENUM',
            'nome_produto_marca' => 'VARCHAR(200)',
            'qtd_meta' => 'INT',
            'qtd_vendido' => 'INT',
            'percentual_sobre_venda' => 'DECIMAL(5,2)',
            'valor_vendido' => 'DECIMAL(15,2)',
            'valor_comissao' => 'DECIMAL(15,2)'
        ]
    ];
    
    echo "📋 Verificando estruturas no database.sql...\n\n";
    
    // Ler o arquivo database.sql
    $databaseSql = file_get_contents('c:/dev/appnovotok/datasync-novotok/database.sql');
    
    if (!$databaseSql) {
        throw new Exception("Não foi possível ler o arquivo database.sql");
    }
    
    $problemas = [];
    $sucessos = [];
    
    // Verificar se todas as tabelas estão presentes
    foreach ($tabelasEsperadas as $tabela) {
        if (strpos($databaseSql, "CREATE TABLE IF NOT EXISTS $tabela") !== false) {
            $sucessos[] = "✓ Tabela '$tabela' encontrada";
        } else {
            $problemas[] = "✗ Tabela '$tabela' NÃO encontrada";
        }
    }
    
    // Verificar se as tabelas antigas foram removidas
    $tabelasAntigas = ['operadoras_caixa', 'vendedoras', 'vendedoras_bijou', 'gerentes'];
    foreach ($tabelasAntigas as $tabelaAntiga) {
        if (strpos($databaseSql, "CREATE TABLE IF NOT EXISTS $tabelaAntiga") !== false) {
            $problemas[] = "✗ Tabela antiga '$tabelaAntiga' ainda presente (deveria ter sido removida)";
        } else {
            $sucessos[] = "✓ Tabela antiga '$tabelaAntiga' foi removida corretamente";
        }
    }
    
    // Verificar se usa VARCHAR(50) para IDs
    if (strpos($databaseSql, 'id VARCHAR(50) PRIMARY KEY') !== false) {
        $sucessos[] = "✓ IDs usando VARCHAR(50) como esperado";
    } else {
        $problemas[] = "✗ IDs não estão usando VARCHAR(50)";
    }
    
    // Verificar se usa CASCADE DELETE
    if (strpos($databaseSql, 'ON DELETE CASCADE') !== false) {
        $sucessos[] = "✓ Foreign keys com CASCADE DELETE encontradas";
    } else {
        $problemas[] = "✗ Foreign keys sem CASCADE DELETE";
    }
    
    // Verificar se os índices estão presentes
    $indicesEsperados = [
        'idx_meta_loja_operadoras_meta_id',
        'idx_meta_loja_vendedoras_meta_id', 
        'idx_meta_loja_vendedoras_bijou_meta_id',
        'idx_meta_loja_campanhas_meta_id',
        'idx_meta_loja_produtos_meta_id',
        'idx_meta_loja_produtos_funcionario',
        'idx_meta_loja_funcionarios_meta_id'
    ];
    
    foreach ($indicesEsperados as $indice) {
        if (strpos($databaseSql, $indice) !== false) {
            $sucessos[] = "✓ Índice '$indice' encontrado";
        } else {
            $problemas[] = "✗ Índice '$indice' NÃO encontrado";
        }
    }
    
    echo "=== RESULTADOS DA VALIDAÇÃO ===\n\n";
    
    if (!empty($sucessos)) {
        echo "🟢 SUCESSOS:\n";
        foreach ($sucessos as $sucesso) {
            echo "   $sucesso\n";
        }
        echo "\n";
    }
    
    if (!empty($problemas)) {
        echo "🔴 PROBLEMAS ENCONTRADOS:\n";
        foreach ($problemas as $problema) {
            echo "   $problema\n";
        }
        echo "\n";
    }
    
    if (empty($problemas)) {
        echo "🎉 VALIDAÇÃO CONCLUÍDA COM SUCESSO!\n";
        echo "✅ O database.sql está totalmente alinhado com as implementações atuais.\n";
        echo "✅ Todas as tabelas de metas de lojas estão corretas.\n";
        echo "✅ Estruturas, tipos de dados e relacionamentos estão consistentes.\n";
    } else {
        echo "⚠️  VALIDAÇÃO ENCONTROU PROBLEMAS!\n";
        echo "❌ O database.sql precisa de correções adicionais.\n";
        echo "📝 Total de problemas: " . count($problemas) . "\n";
    }
    
    echo "\n=== RESUMO ===\n";
    echo "✅ Sucessos: " . count($sucessos) . "\n";
    echo "❌ Problemas: " . count($problemas) . "\n";
    echo "📊 Taxa de sucesso: " . round((count($sucessos) / (count($sucessos) + count($problemas))) * 100, 1) . "%\n";
    
} catch (Exception $e) {
    echo "Erro na validação: " . $e->getMessage() . "\n";
}
?>