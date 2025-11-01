<?php
// Script para executar a atualização da estrutura da tabela metas_lojas
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
    
    echo "Conectado ao banco de dados com sucesso!\n";
    
    // Desabilitar verificações de chave estrangeira
    echo "0. Desabilitando verificações de chave estrangeira...\n";
    $conn->exec("SET FOREIGN_KEY_CHECKS = 0");
    echo "   Verificações desabilitadas!\n";
    
    // 1. Fazer backup da tabela existente (se houver dados)
    echo "1. Fazendo backup da tabela existente...\n";
    try {
        $conn->exec("CREATE TABLE IF NOT EXISTS metas_lojas_backup AS SELECT * FROM metas_lojas");
        echo "   Backup criado com sucesso!\n";
    } catch (Exception $e) {
        echo "   Aviso: " . $e->getMessage() . "\n";
    }
    
    // 2. Remover a tabela existente
    echo "2. Removendo tabela existente...\n";
    $conn->exec("DROP TABLE IF EXISTS metas_lojas");
    echo "   Tabela removida com sucesso!\n";
    
    // 3. Criar a nova estrutura da tabela
    echo "3. Criando nova estrutura da tabela...\n";
    $sql = "CREATE TABLE IF NOT EXISTS metas_lojas (
        id VARCHAR(50) PRIMARY KEY,
        loja_id VARCHAR(50) NOT NULL,
        nome_loja VARCHAR(100) NOT NULL,
        mes INT NOT NULL COMMENT 'Mês da meta (1-12)',
        ano INT NOT NULL COMMENT 'Ano da meta',
        grupo_meta_id VARCHAR(50) NOT NULL,
        ativo BOOLEAN NOT NULL DEFAULT 1,
        data_criacao DATE NOT NULL DEFAULT (CURRENT_DATE),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (grupo_meta_id) REFERENCES grupos_metas_produtos(id) ON DELETE CASCADE,
        INDEX idx_loja_id (loja_id),
        INDEX idx_grupo_meta_id (grupo_meta_id),
        INDEX idx_periodo (mes, ano),
        UNIQUE KEY unique_loja_periodo (loja_id, mes, ano)
    )";
    $conn->exec($sql);
    echo "   Nova estrutura criada com sucesso!\n";
    
    // 4. Inserir um grupo de metas de exemplo
    echo "4. Inserindo grupo de metas de exemplo...\n";
    $sql = "INSERT IGNORE INTO grupos_metas_produtos (id, nome, descricao, ativo) VALUES
            ('1', 'Grupo Meta Padrão', 'Grupo de metas padrão para testes', 1)";
    $conn->exec($sql);
    echo "   Grupo de metas inserido com sucesso!\n";
    
    // 5. Verificar se o grupo foi inserido
    echo "5. Verificando grupo de metas...\n";
    $stmt = $conn->query("SELECT * FROM grupos_metas_produtos WHERE id = '1'");
    $grupo = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($grupo) {
        echo "   Grupo encontrado: " . $grupo['nome'] . "\n";
    } else {
        echo "   Erro: Grupo não encontrado!\n";
    }
    
    // 6. Verificar estrutura da nova tabela
    echo "6. Verificando estrutura da nova tabela...\n";
    $stmt = $conn->query("DESCRIBE metas_lojas");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($columns as $column) {
        echo "   - " . $column['Field'] . " (" . $column['Type'] . ")\n";
    }
    
    // 7. Reabilitar verificações de chave estrangeira
    echo "7. Reabilitando verificações de chave estrangeira...\n";
    $conn->exec("SET FOREIGN_KEY_CHECKS = 1");
    echo "   Verificações reabilitadas!\n";
    
    echo "\nAtualização concluída com sucesso!\n";
    
} catch (Exception $e) {
    echo "Erro: " . $e->getMessage() . "\n";
}
?>