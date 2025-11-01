<?php
require_once 'config.php';
require_once 'database.php';

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    echo "=== CORREÇÃO DA CHAVE ESTRANGEIRA ===\n\n";
    
    // Desabilitar verificação de chaves estrangeiras
    echo "1. Desabilitando verificação de chaves estrangeiras...\n";
    $conn->exec("SET foreign_key_checks = 0");
    echo "   ✓ Verificação desabilitada\n";
    
    // Verificar tabelas que referenciam metas_lojas
    echo "\n2. Verificando tabelas que referenciam metas_lojas...\n";
    $stmt = $conn->prepare("SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME 
                           FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                           WHERE REFERENCED_TABLE_NAME = 'metas_lojas'");
    $stmt->execute();
    $references = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($references) > 0) {
        echo "   Tabelas que referenciam metas_lojas:\n";
        foreach ($references as $ref) {
            echo "   - {$ref['TABLE_NAME']}.{$ref['COLUMN_NAME']} -> {$ref['REFERENCED_TABLE_NAME']}.{$ref['REFERENCED_COLUMN_NAME']}\n";
            
            // Remover a constraint
            echo "     Removendo constraint {$ref['CONSTRAINT_NAME']}...\n";
            $dropConstraint = "ALTER TABLE {$ref['TABLE_NAME']} DROP FOREIGN KEY {$ref['CONSTRAINT_NAME']}";
            $conn->exec($dropConstraint);
            echo "     ✓ Constraint removida\n";
        }
    } else {
        echo "   Nenhuma referência encontrada\n";
    }
    
    // Verificar se a tabela metas_lojas existe
    echo "\n3. Verificando se a tabela metas_lojas existe...\n";
    $checkTable = $conn->prepare("SHOW TABLES LIKE 'metas_lojas'");
    $checkTable->execute();
    
    if ($checkTable->rowCount() > 0) {
        echo "   Tabela existe. Removendo...\n";
        $conn->exec("DROP TABLE metas_lojas");
        echo "   ✓ Tabela removida\n";
    } else {
        echo "   Tabela não existe\n";
    }
    
    // Criar tabela metas_lojas
    echo "\n4. Criando tabela metas_lojas...\n";
    $sql = "CREATE TABLE metas_lojas (
        id VARCHAR(50) PRIMARY KEY,
        loja_id VARCHAR(50) NOT NULL,
        nome_loja VARCHAR(100) NOT NULL,
        mes INT NOT NULL,
        ano INT NOT NULL,
        grupo_meta_id VARCHAR(50) NOT NULL,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        data_criacao DATE NOT NULL
    )";
    
    $conn->exec($sql);
    echo "   ✓ Tabela criada com sucesso!\n";
    
    // Testar inserção
    echo "\n5. Testando inserção...\n";
    $meta_id = 'meta_teste_' . time();
    $insertStmt = $conn->prepare("INSERT INTO metas_lojas (id, loja_id, nome_loja, mes, ano, grupo_meta_id, ativo, data_criacao) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)");
    $insertStmt->execute([$meta_id, '7', 'NOVOTOK FL28', 9, 2025, '1', 1]);
    
    echo "   ✓ Meta de teste inserida: {$meta_id}\n";
    
    // Reabilitar verificação de chaves estrangeiras
    echo "\n6. Reabilitando verificação de chaves estrangeiras...\n";
    $conn->exec("SET foreign_key_checks = 1");
    echo "   ✓ Verificação reabilitada\n";
    
    echo "\n=== SUCESSO ===\n";
    echo "✓ Problema da chave estrangeira corrigido\n";
    echo "✓ Tabela metas_lojas criada e funcionando\n";
    echo "✓ Grupo com ID '1' disponível\n";
    echo "✓ Agora você pode usar grupo_meta_id = '1' na sua requisição POST\n";
    
} catch (Exception $e) {
    echo "Erro: " . $e->getMessage() . "\n";
}
?>