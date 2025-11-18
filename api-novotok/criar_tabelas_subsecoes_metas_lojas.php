<?php
// Script para criar tabelas das subseções de metas de lojas
require_once 'config.php';
require_once 'database.php';

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    echo "=== CRIAÇÃO DAS TABELAS DE SUBSEÇÕES METAS LOJAS ===\n\n";
    
    // Primeiro, adicionar a coluna valor_venda_loja_total à tabela metas_lojas se não existir
    try {
        $stmt = $conn->prepare("SHOW COLUMNS FROM metas_lojas LIKE 'valor_venda_loja_total'");
        $stmt->execute();
        
        if ($stmt->rowCount() == 0) {
            $conn->exec("ALTER TABLE metas_lojas ADD COLUMN valor_venda_loja_total DECIMAL(15,2) DEFAULT 0");
            echo "✓ Coluna 'valor_venda_loja_total' adicionada à tabela metas_lojas\n";
        } else {
            echo "✓ Coluna 'valor_venda_loja_total' já existe na tabela metas_lojas\n";
        }
    } catch (PDOException $e) {
        echo "⚠ Erro ao adicionar coluna valor_venda_loja_total: " . $e->getMessage() . "\n";
    }
    
    // Definir as tabelas a serem criadas
    $tabelas = [
        'meta_loja_operadoras_caixa' => "
            CREATE TABLE IF NOT EXISTS meta_loja_operadoras_caixa (
                id VARCHAR(50) PRIMARY KEY,
                meta_loja_id VARCHAR(50) NOT NULL,
                nome VARCHAR(100) NOT NULL,
                funcao VARCHAR(50) NOT NULL DEFAULT 'OPERADOR(A) DE CAIXA',
                cadastros_positivados INT NOT NULL DEFAULT 0,
                produtos_destaque INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_meta_loja_operadoras_meta_id (meta_loja_id),
                FOREIGN KEY (meta_loja_id) REFERENCES metas_lojas(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        ",
        
        'meta_loja_vendedoras' => "
            CREATE TABLE IF NOT EXISTS meta_loja_vendedoras (
                id VARCHAR(50) PRIMARY KEY,
                meta_loja_id VARCHAR(50) NOT NULL,
                nome VARCHAR(100) NOT NULL,
                funcao VARCHAR(50) NOT NULL DEFAULT 'ATENDENTE DE LOJA',
                valor_vendido_total DECIMAL(15,2) NOT NULL DEFAULT 0,
                esmaltes INT NOT NULL DEFAULT 0,
                profissional_parceiras INT NOT NULL DEFAULT 0,
                valor_vendido_make DECIMAL(15,2) NOT NULL DEFAULT 0,
                quantidade_malka INT NOT NULL DEFAULT 0,
                valor_malka DECIMAL(15,2) NOT NULL DEFAULT 0,
                bijou_make_bolsas DECIMAL(15,2) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_meta_loja_vendedoras_meta_id (meta_loja_id),
                FOREIGN KEY (meta_loja_id) REFERENCES metas_lojas(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        ",
        
        'meta_loja_vendedoras_bijou' => "
            CREATE TABLE IF NOT EXISTS meta_loja_vendedoras_bijou (
                id VARCHAR(50) PRIMARY KEY,
                meta_loja_id VARCHAR(50) NOT NULL,
                nome VARCHAR(100) NOT NULL,
                funcao VARCHAR(50) NOT NULL DEFAULT 'VENDEDORA BIJOU/MAKE/BOLSAS',
                bijou_make_bolsas INT NOT NULL DEFAULT 0,
                valor_total_bijou_filial DECIMAL(15,2) NOT NULL DEFAULT 0,
                bijou_make_bolsas_secoes DECIMAL(15,2) NOT NULL DEFAULT 0,
                valor_total_bijou_filial_secoes DECIMAL(15,2) NOT NULL DEFAULT 0,
                percentual_comissao_bijou DECIMAL(5,2) NOT NULL DEFAULT 0,
                valor_comissao_bijou DECIMAL(15,2) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_meta_loja_vendedoras_bijou_meta_id (meta_loja_id),
                FOREIGN KEY (meta_loja_id) REFERENCES metas_lojas(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        ",
        
        'meta_loja_gerente' => "
            CREATE TABLE IF NOT EXISTS meta_loja_gerente (
                id VARCHAR(50) PRIMARY KEY,
                meta_loja_id VARCHAR(50) NOT NULL,
                nome VARCHAR(100) NOT NULL,
                funcao VARCHAR(50) NOT NULL DEFAULT 'GERENTE',
                valor_vendido_total DECIMAL(15,2) NOT NULL DEFAULT 0,
                esmaltes INT NOT NULL DEFAULT 0,
                profissional_parceiras INT NOT NULL DEFAULT 0,
                valor_vendido_make DECIMAL(15,2) NOT NULL DEFAULT 0,
                quantidade_malka INT NOT NULL DEFAULT 0,
                valor_malka DECIMAL(15,2) NOT NULL DEFAULT 0,
                bijou_make_bolsas INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_meta_loja_gerente_meta_id (meta_loja_id),
                FOREIGN KEY (meta_loja_id) REFERENCES metas_lojas(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        ",
        
        'meta_loja_campanhas' => "
            CREATE TABLE IF NOT EXISTS meta_loja_campanhas (
                id VARCHAR(50) PRIMARY KEY,
                meta_loja_id VARCHAR(50) NOT NULL,
                nome VARCHAR(100) NOT NULL,
                descricao TEXT,
                quantidade_vendida DECIMAL(15,2) NOT NULL DEFAULT 0,
                atingiu_meta BOOLEAN NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_meta_loja_campanhas_meta_id (meta_loja_id),
                FOREIGN KEY (meta_loja_id) REFERENCES metas_lojas(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        ",
        
        'meta_loja_funcionarios' => "
            CREATE TABLE IF NOT EXISTS meta_loja_funcionarios (
                id VARCHAR(50) PRIMARY KEY,
                meta_loja_id VARCHAR(50) NOT NULL,
                nome VARCHAR(100) NOT NULL,
                funcao VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_meta_loja_funcionarios_meta_id (meta_loja_id),
                FOREIGN KEY (meta_loja_id) REFERENCES metas_lojas(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        ",
        
        'meta_loja_produtos' => "
            CREATE TABLE IF NOT EXISTS meta_loja_produtos (
                id VARCHAR(50) PRIMARY KEY,
                meta_loja_id VARCHAR(50) NOT NULL,
                funcionario_id VARCHAR(50) NOT NULL,
                tipo_funcionario ENUM('operadora_caixa', 'vendedora', 'vendedora_bijou', 'gerente', 'funcionario') NOT NULL,
                nome_produto_marca VARCHAR(200) NOT NULL,
                qtd_meta INT NOT NULL DEFAULT 0,
                percentual_sobre_venda DECIMAL(5,2) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_meta_loja_produtos_meta_id (meta_loja_id),
                INDEX idx_meta_loja_produtos_funcionario (funcionario_id),
                FOREIGN KEY (meta_loja_id) REFERENCES metas_lojas(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        "
    ];
    
    // Criar cada tabela
    foreach ($tabelas as $nomeTabela => $sql) {
        try {
            $conn->exec($sql);
            echo "✓ Tabela '$nomeTabela' criada com sucesso!\n";
        } catch (PDOException $e) {
            echo "✗ Erro ao criar tabela '$nomeTabela': " . $e->getMessage() . "\n";
        }
    }
    
    echo "\n=== VERIFICAÇÃO DAS TABELAS CRIADAS ===\n\n";
    
    // Verificar se as tabelas foram criadas
    $tabelasVerificar = array_keys($tabelas);
    $tabelasVerificar[] = 'metas_lojas'; // Incluir a tabela principal
    
    foreach ($tabelasVerificar as $table) {
        try {
            $stmt = $conn->query("SHOW TABLES LIKE '$table'");
            
            if ($stmt->rowCount() > 0) {
                echo "✓ Tabela '$table' existe\n";
                
                // Mostrar estrutura da tabela
                $descStmt = $conn->query("DESCRIBE $table");
                $campos = $descStmt->fetchAll(PDO::FETCH_ASSOC);
                
                echo "  Campos: " . count($campos) . "\n";
                foreach ($campos as $campo) {
                    echo "  - {$campo['Field']}: {$campo['Type']}\n";
                }
                echo "\n";
            } else {
                echo "✗ Tabela '$table' NÃO existe\n";
            }
        } catch (PDOException $e) {
            echo "✗ Erro ao verificar tabela '$table': " . $e->getMessage() . "\n";
        }
    }
    
    echo "\n=== CRIAÇÃO CONCLUÍDA ===\n";
    echo "Processo de criação das tabelas finalizado!\n";
    
} catch (Exception $e) {
    echo "ERRO: " . $e->getMessage() . "\n";
    exit(1);
}
?>