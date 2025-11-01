<?php
// Script para testar o cadastro de meta da loja diretamente
require_once 'config.php';

try {
    // Obter configuração do banco de dados
    $config = Config::get();
    $dbConfig = $config['database'];
    
    // Conectar ao banco de dados
    $conn = new PDO(
        "mysql:host={$dbConfig['host']};dbname={$dbConfig['name']};charset={$dbConfig['charset']}", 
        $dbConfig['username'], 
        $dbConfig['password']
    );
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "=== TESTE DE CADASTRO DE META DA LOJA ===\n\n";
    
    // 1. Verificar se o grupo de metas existe
    echo "1. Verificando grupo de metas com ID '1'...\n";
    $stmt = $conn->prepare("SELECT * FROM grupos_metas_produtos WHERE id = ? AND ativo = 1");
    $stmt->bindValue(1, '1');
    $stmt->execute();
    $grupo = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($grupo) {
        echo "   ✓ Grupo encontrado: " . $grupo['nome'] . "\n";
        echo "   ✓ Descrição: " . $grupo['descricao'] . "\n";
        echo "   ✓ Status: " . ($grupo['ativo'] ? 'Ativo' : 'Inativo') . "\n";
    } else {
        echo "   ✗ Grupo não encontrado ou inativo!\n";
        exit;
    }
    
    // 2. Verificar se já existe meta para esta loja no período
    echo "\n2. Verificando se já existe meta para loja '7' em 09/2025...\n";
    $stmt = $conn->prepare("SELECT id FROM metas_lojas WHERE loja_id = ? AND mes = ? AND ano = ?");
    $stmt->bindValue(1, '7');
    $stmt->bindValue(2, 9);
    $stmt->bindValue(3, 2025);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        echo "   ⚠ Já existe uma meta para esta loja neste período. Removendo para teste...\n";
        $deleteStmt = $conn->prepare("DELETE FROM metas_lojas WHERE loja_id = ? AND mes = ? AND ano = ?");
        $deleteStmt->bindValue(1, '7');
        $deleteStmt->bindValue(2, 9);
        $deleteStmt->bindValue(3, 2025);
        $deleteStmt->execute();
        echo "   ✓ Meta anterior removida!\n";
    } else {
        echo "   ✓ Não há meta existente para este período.\n";
    }
    
    // 3. Tentar cadastrar a meta
    echo "\n3. Cadastrando nova meta da loja...\n";
    $meta_id = uniqid('meta_loja_', true);
    
    $sql = "INSERT INTO metas_lojas (id, loja_id, nome_loja, mes, ano, grupo_meta_id, ativo, data_criacao) 
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(1, $meta_id);
    $stmt->bindValue(2, '7');
    $stmt->bindValue(3, 'NOVOTOK FL28');
    $stmt->bindValue(4, 9);
    $stmt->bindValue(5, 2025);
    $stmt->bindValue(6, '1');
    $stmt->bindValue(7, 1);
    
    if ($stmt->execute()) {
        echo "   ✓ Meta cadastrada com sucesso!\n";
        echo "   ✓ ID da meta: " . $meta_id . "\n";
        
        // 4. Buscar a meta criada
        echo "\n4. Verificando meta criada...\n";
        $sqlSelect = "SELECT 
                        ml.id,
                        ml.loja_id,
                        ml.nome_loja,
                        ml.mes,
                        ml.ano,
                        ml.grupo_meta_id,
                        gmp.nome as grupo_meta_nome,
                        gmp.descricao as grupo_meta_descricao,
                        ml.data_criacao,
                        ml.ativo
                      FROM metas_lojas ml
                      LEFT JOIN grupos_metas_produtos gmp ON ml.grupo_meta_id = gmp.id
                      WHERE ml.id = ?";
        $stmtSelect = $conn->prepare($sqlSelect);
        $stmtSelect->bindValue(1, $meta_id);
        $stmtSelect->execute();
        $meta = $stmtSelect->fetch(PDO::FETCH_ASSOC);
        
        if ($meta) {
            echo "   ✓ Meta encontrada:\n";
            echo "     - ID: " . $meta['id'] . "\n";
            echo "     - Loja ID: " . $meta['loja_id'] . "\n";
            echo "     - Nome da Loja: " . $meta['nome_loja'] . "\n";
            echo "     - Período: " . $meta['mes'] . "/" . $meta['ano'] . "\n";
            echo "     - Grupo Meta: " . $meta['grupo_meta_nome'] . "\n";
            echo "     - Status: " . ($meta['ativo'] ? 'Ativo' : 'Inativo') . "\n";
            echo "     - Data Criação: " . $meta['data_criacao'] . "\n";
        } else {
            echo "   ✗ Erro: Meta não encontrada após criação!\n";
        }
        
    } else {
        echo "   ✗ Erro ao cadastrar meta!\n";
    }
    
    echo "\n=== TESTE CONCLUÍDO ===\n";
    
} catch (Exception $e) {
    echo "Erro: " . $e->getMessage() . "\n";
}
?>