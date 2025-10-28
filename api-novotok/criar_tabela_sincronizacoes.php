<?php
require_once 'database.php';

// Instancia a classe Database
$database = new Database();
$conn = $database->getConnection();

try {
    // Verifica se a tabela já existe
    $checkTable = "SHOW TABLES LIKE 'sincronizacoes'";
    $stmt = $conn->prepare($checkTable);
    $stmt->execute();
    $tableExists = $stmt->rowCount() > 0;

    if (!$tableExists) {
        // Cria a tabela sincronizacoes
        $createTable = "CREATE TABLE sincronizacoes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            codaparelho VARCHAR(200) NOT NULL,
            quantidade_produtos INT NOT NULL,
            data_sincronizacao DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )";
        $conn->exec($createTable);
        echo "Tabela 'sincronizacoes' criada com sucesso!";
    } else {
        echo "A tabela 'sincronizacoes' já existe.";
    }
} catch (PDOException $e) {
    echo "Erro ao criar tabela: " . $e->getMessage();
}
?> 