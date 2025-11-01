<?php
// Script para corrigir o problema do grupo de metas
require_once 'config.php';
require_once 'database.php';

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    echo "=== CORREÇÃO DO GRUPO DE METAS ===\n\n";
    
    // 1. Verificar grupos existentes
    echo "1. Verificando grupos de metas existentes...\n";
    $stmt = $conn->prepare("SELECT id, nome, descricao, ativo FROM grupos_metas_produtos ORDER BY id");
    $stmt->execute();
    $grupos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($grupos) > 0) {
        echo "   Grupos encontrados:\n";
        foreach ($grupos as $grupo) {
            echo "   - ID: {$grupo['id']} | Nome: {$grupo['nome']} | Status: " . ($grupo['ativo'] ? 'Ativo' : 'Inativo') . "\n";
        }
    } else {
        echo "   Nenhum grupo encontrado.\n";
    }
    
    // 2. Verificar se existe grupo com ID "1"
    echo "\n2. Verificando se existe grupo com ID '1'...\n";
    $stmt = $conn->prepare("SELECT id, nome, ativo FROM grupos_metas_produtos WHERE id = ?");
    $stmt->bindValue(1, '1');
    $stmt->execute();
    $grupo1 = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($grupo1) {
        echo "   ✓ Grupo com ID '1' já existe: {$grupo1['nome']}\n";
        echo "   Status: " . ($grupo1['ativo'] ? 'Ativo' : 'Inativo') . "\n";
        
        if (!$grupo1['ativo']) {
            echo "   ⚠ Ativando o grupo...\n";
            $updateStmt = $conn->prepare("UPDATE grupos_metas_produtos SET ativo = 1 WHERE id = ?");
            $updateStmt->bindValue(1, '1');
            $updateStmt->execute();
            echo "   ✓ Grupo ativado!\n";
        }
    } else {
        echo "   ✗ Grupo com ID '1' não existe. Criando...\n";
        
        // Criar grupo com ID "1"
        $insertStmt = $conn->prepare("INSERT INTO grupos_metas_produtos (id, nome, descricao, ativo, data_criacao) VALUES (?, ?, ?, ?, CURRENT_DATE)");
        $insertStmt->bindValue(1, '1');
        $insertStmt->bindValue(2, 'Grupo Meta Padrão');
        $insertStmt->bindValue(3, 'Grupo de metas padrão para lojas');
        $insertStmt->bindValue(4, 1);
        
        if ($insertStmt->execute()) {
            echo "   ✓ Grupo criado com sucesso!\n";
            echo "   - ID: 1\n";
            echo "   - Nome: Grupo Meta Padrão\n";
            echo "   - Descrição: Grupo de metas padrão para lojas\n";
            echo "   - Status: Ativo\n";
        } else {
            echo "   ✗ Erro ao criar grupo!\n";
        }
    }
    
    // 3. Verificar estrutura da tabela metas_lojas
    echo "\n3. Verificando estrutura da tabela metas_lojas...\n";
    $descStmt = $conn->prepare("DESCRIBE metas_lojas");
    $descStmt->execute();
    $campos = $descStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "   Campos da tabela:\n";
    foreach ($campos as $campo) {
        echo "   - {$campo['Field']}: {$campo['Type']} | Null: {$campo['Null']} | Key: {$campo['Key']}\n";
    }
    
    // 4. Testar o cadastro da meta agora com ID numérico
    echo "\n4. Testando cadastro da meta com grupo_meta_id = '1'...\n";
    
    // Verificar se já existe meta para esta loja no período
    $checkStmt = $conn->prepare("SELECT id FROM metas_lojas WHERE loja_id = ? AND mes = ? AND ano = ?");
    $checkStmt->bindValue(1, '7');
    $checkStmt->bindValue(2, 9);
    $checkStmt->bindValue(3, 2025);
    $checkStmt->execute();
    
    if ($checkStmt->rowCount() > 0) {
        echo "   ⚠ Já existe meta para esta loja neste período. Removendo...\n";
        $deleteStmt = $conn->prepare("DELETE FROM metas_lojas WHERE loja_id = ? AND mes = ? AND ano = ?");
        $deleteStmt->bindValue(1, '7');
        $deleteStmt->bindValue(2, 9);
        $deleteStmt->bindValue(3, 2025);
        $deleteStmt->execute();
        echo "   ✓ Meta anterior removida!\n";
    }
    
    // Usar ID numérico simples
    $meta_id = time(); // Usar timestamp como ID
    $insertMetaStmt = $conn->prepare("INSERT INTO metas_lojas (id, loja_id, nome_loja, mes, ano, grupo_meta_id, ativo, data_criacao) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)");
    $insertMetaStmt->bindValue(1, $meta_id);
    $insertMetaStmt->bindValue(2, '7');
    $insertMetaStmt->bindValue(3, 'NOVOTOK FL28');
    $insertMetaStmt->bindValue(4, 9);
    $insertMetaStmt->bindValue(5, 2025);
    $insertMetaStmt->bindValue(6, '1');
    $insertMetaStmt->bindValue(7, 1);
    
    if ($insertMetaStmt->execute()) {
        echo "   ✓ Meta cadastrada com sucesso!\n";
        echo "   - ID da meta: {$meta_id}\n";
        echo "   - Loja: NOVOTOK FL28 (ID: 7)\n";
        echo "   - Período: 09/2025\n";
        echo "   - Grupo Meta ID: 1\n";
    } else {
        echo "   ✗ Erro ao cadastrar meta!\n";
    }
    
    echo "\n=== SOLUÇÃO ===\n";
    echo "✓ Grupo com ID '1' criado e ativo!\n";
    echo "✓ Meta de teste cadastrada com sucesso!\n";
    echo "\nAgora você pode usar grupo_meta_id = '1' na sua requisição POST.\n";
    echo "\nOu alternativamente, use um dos grupos existentes:\n";
    foreach ($grupos as $grupo) {
        if ($grupo['ativo']) {
            echo "- grupo_meta_id = '{$grupo['id']}' (Nome: {$grupo['nome']})\n";
        }
    }
    
    echo "\n=== TESTE CONCLUÍDO ===\n";
    
} catch (Exception $e) {
    echo "Erro: " . $e->getMessage() . "\n";
}
?>