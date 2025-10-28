<?php
require_once 'database.php';

// Instanciar a conexão com o banco de dados
$db = new Database();
$conn = $db->getConnection();

// Código do aparelho a verificar
$codaparelho = 'ad7af09b55235f4a';

// Consultar o aparelho
$stmt = $conn->prepare('SELECT * FROM aparelhos WHERE codaparelho = :codaparelho');
$stmt->bindParam(':codaparelho', $codaparelho);
$stmt->execute();
$aparelho = $stmt->fetch(PDO::FETCH_ASSOC);

echo "Aparelho com codaparelho = $codaparelho:\n";
if ($aparelho) {
    echo "ID: " . $aparelho['id'] . "\n";
    echo "Código: " . $aparelho['codaparelho'] . "\n";
    echo "Autorizado: " . ($aparelho['autorized'] == 1 ? 'Sim' : 'Não') . "\n";
    echo "Ativo: " . (isset($aparelho['ativo']) && $aparelho['ativo'] == 1 ? 'Sim' : 'Não') . "\n";
    echo "Vendedor ID: " . $aparelho['vendedor_id'] . "\n";
    
    // Verificar se está autorizado conforme a consulta que usamos na API
    $stmt = $conn->prepare('SELECT * FROM aparelhos WHERE codaparelho = :codaparelho AND autorized = 1');
    $stmt->bindParam(':codaparelho', $codaparelho);
    $stmt->execute();
    $autorizado = $stmt->rowCount() > 0;
    
    echo "\nResultado da verificação de autorização: " . ($autorizado ? 'Autorizado' : 'Não autorizado') . "\n";
    
    // Verificar se o campo autorized é numérico ou string
    echo "Tipo do campo 'autorized': " . gettype($aparelho['autorized']) . "\n";
    echo "Valor do campo 'autorized': '" . $aparelho['autorized'] . "'\n";
    
    // Verificar se há alguma diferença na comparação
    echo "Comparação autorized == 1: " . ($aparelho['autorized'] == 1 ? 'true' : 'false') . "\n";
    echo "Comparação autorized === 1: " . ($aparelho['autorized'] === 1 ? 'true' : 'false') . "\n";
    echo "Comparação autorized == '1': " . ($aparelho['autorized'] == '1' ? 'true' : 'false') . "\n";
    echo "Comparação autorized === '1': " . ($aparelho['autorized'] === '1' ? 'true' : 'false') . "\n";
} else {
    echo "Aparelho não encontrado.\n";
}
?> 