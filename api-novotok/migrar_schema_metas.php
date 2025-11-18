<?php
header("Content-Type: application/json; charset=UTF-8");

require __DIR__ . '/database.php';

function getConnection() {
    $database = new Database();
    return $database->getConnection();
}

function columnExists(PDO $conn, string $table, string $column): bool {
    $stmt = $conn->prepare("SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
    $stmt->execute([$table, $column]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return (int)$row['cnt'] > 0;
}

function addColumnIfMissing(PDO $conn, string $table, string $column, string $definition, array &$actions) {
    if (!columnExists($conn, $table, $column)) {
        $sql = "ALTER TABLE $table ADD COLUMN $column $definition";
        $conn->exec($sql);
        $actions[] = [
            'table' => $table,
            'action' => 'ADD COLUMN',
            'column' => $column,
            'definition' => $definition
        ];
    }
}

function getEnumDefinition(PDO $conn, string $table, string $column): ?string {
    $stmt = $conn->prepare("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
    $stmt->execute([$table, $column]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ? $row['COLUMN_TYPE'] : null;
}

function migrateTipoFuncionarioEnum(PDO $conn, array &$actions) {
    $table = 'meta_loja_produtos';
    $column = 'tipo_funcionario';
    $current = getEnumDefinition($conn, $table, $column);
    if (!$current) {
        // coluna não existe; cria já com enum correto
        $sql = "ALTER TABLE $table ADD COLUMN $column ENUM('operadora_caixa','vendedora','vendedora_bijou','gerente','funcionario') NOT NULL";
        $conn->exec($sql);
        $actions[] = ['table' => $table, 'action' => 'ADD COLUMN', 'column' => $column, 'definition' => "ENUM('operadora_caixa','vendedora','vendedora_bijou','gerente','funcionario') NOT NULL"];
        return;
    }

    $normalized = strtolower($current);
    $needsFull = !(
        strpos($normalized, "operadora_caixa") !== false &&
        strpos($normalized, "vendedora_bijou") !== false &&
        strpos($normalized, "gerente") !== false &&
        strpos($normalized, "funcionario") !== false
    );

    if ($needsFull) {
        // Passo 1: incluir valores antigos e novos simultaneamente
        $sql1 = "ALTER TABLE $table MODIFY COLUMN $column ENUM('operadora','operadora_caixa','vendedora','vendedoraBijou','vendedora_bijou','gerente','funcionario') NOT NULL";
        $conn->exec($sql1);
        $actions[] = ['table' => $table, 'action' => 'MODIFY COLUMN', 'column' => $column, 'definition' => "ENUM('operadora','operadora_caixa','vendedora','vendedoraBijou','vendedora_bijou','gerente','funcionario') NOT NULL"];

        // Passo 2: migrar dados para novos valores
        $conn->exec("UPDATE $table SET $column='operadora_caixa' WHERE $column='operadora'");
        $conn->exec("UPDATE $table SET $column='vendedora_bijou' WHERE $column='vendedoraBijou'");
        $actions[] = ['table' => $table, 'action' => 'UPDATE DATA', 'column' => $column, 'notes' => 'Mapeou operadora->operadora_caixa e vendedoraBijou->vendedora_bijou'];

        // Passo 3: remover valores antigos do ENUM
        $sql3 = "ALTER TABLE $table MODIFY COLUMN $column ENUM('operadora_caixa','vendedora','vendedora_bijou','gerente','funcionario') NOT NULL";
        $conn->exec($sql3);
        $actions[] = ['table' => $table, 'action' => 'MODIFY COLUMN', 'column' => $column, 'definition' => "ENUM('operadora_caixa','vendedora','vendedora_bijou','gerente','funcionario') NOT NULL"];
    }
}

function main() {
    $conn = getConnection();
    $conn->beginTransaction();
    $actions = [];

    try {
        // Garantir colunas esperadas
        addColumnIfMissing($conn, 'metas_lojas', 'valor_venda_loja_total', 'DECIMAL(15,2) NOT NULL DEFAULT 0', $actions);

        addColumnIfMissing($conn, 'meta_loja_vendedoras', 'valor_vendido_total', 'DECIMAL(15,2) NOT NULL DEFAULT 0', $actions);
        addColumnIfMissing($conn, 'meta_loja_vendedoras', 'esmaltes', 'INT NOT NULL DEFAULT 0', $actions);
        addColumnIfMissing($conn, 'meta_loja_vendedoras', 'profissional_parceiras', 'INT NOT NULL DEFAULT 0', $actions);
        addColumnIfMissing($conn, 'meta_loja_vendedoras', 'valor_vendido_make', 'DECIMAL(15,2) NOT NULL DEFAULT 0', $actions);
        addColumnIfMissing($conn, 'meta_loja_vendedoras', 'bijou_make_bolsas', 'DECIMAL(15,2) NOT NULL DEFAULT 0', $actions);

        addColumnIfMissing($conn, 'meta_loja_gerente', 'valor_vendido_total', 'DECIMAL(15,2) NOT NULL DEFAULT 0', $actions);
        addColumnIfMissing($conn, 'meta_loja_gerente', 'esmaltes', 'INT NOT NULL DEFAULT 0', $actions);
        addColumnIfMissing($conn, 'meta_loja_gerente', 'profissional_parceiras', 'INT NOT NULL DEFAULT 0', $actions);
        addColumnIfMissing($conn, 'meta_loja_gerente', 'valor_vendido_make', 'DECIMAL(15,2) NOT NULL DEFAULT 0', $actions);
        // Garantir bijou_make_bolsas como DECIMAL em meta_loja_gerente
        if (!columnExists($conn, 'meta_loja_gerente', 'bijou_make_bolsas')) {
            addColumnIfMissing($conn, 'meta_loja_gerente', 'bijou_make_bolsas', 'DECIMAL(15,2) NOT NULL DEFAULT 0', $actions);
        } else {
            // Ajustar tipo se necessário
            $conn->exec("ALTER TABLE meta_loja_gerente MODIFY COLUMN bijou_make_bolsas DECIMAL(15,2) NOT NULL DEFAULT 0");
            $actions[] = ['table' => 'meta_loja_gerente', 'action' => 'MODIFY COLUMN', 'column' => 'bijou_make_bolsas', 'definition' => 'DECIMAL(15,2) NOT NULL DEFAULT 0'];
        }

        // Garantir tipo DECIMAL em meta_loja_vendedoras_bijou
        if (!columnExists($conn, 'meta_loja_vendedoras_bijou', 'bijou_make_bolsas')) {
            addColumnIfMissing($conn, 'meta_loja_vendedoras_bijou', 'bijou_make_bolsas', 'DECIMAL(15,2) NOT NULL DEFAULT 0', $actions);
        } else {
            $conn->exec("ALTER TABLE meta_loja_vendedoras_bijou MODIFY COLUMN bijou_make_bolsas DECIMAL(15,2) NOT NULL DEFAULT 0");
            $actions[] = ['table' => 'meta_loja_vendedoras_bijou', 'action' => 'MODIFY COLUMN', 'column' => 'bijou_make_bolsas', 'definition' => 'DECIMAL(15,2) NOT NULL DEFAULT 0'];
        }

        // Nova coluna para total de bijou da filial por vendedora bijou
        addColumnIfMissing($conn, 'meta_loja_vendedoras_bijou', 'valor_total_bijou_filial', 'DECIMAL(15,2) NOT NULL DEFAULT 0', $actions);

        // Novas colunas para totais por seções (vendedora e filial)
        addColumnIfMissing($conn, 'meta_loja_vendedoras_bijou', 'bijou_make_bolsas_secoes', 'DECIMAL(15,2) NOT NULL DEFAULT 0', $actions);
        addColumnIfMissing($conn, 'meta_loja_vendedoras_bijou', 'valor_total_bijou_filial_secoes', 'DECIMAL(15,2) NOT NULL DEFAULT 0', $actions);

        addColumnIfMissing($conn, 'meta_loja_campanhas', 'descricao', 'TEXT', $actions);

        migrateTipoFuncionarioEnum($conn, $actions);

        $conn->commit();
        echo json_encode(['status' => 1, 'message' => 'Migração concluída', 'actions' => $actions]);
    } catch (Exception $e) {
        $conn->rollBack();
        http_response_code(500);
        echo json_encode(['status' => 0, 'message' => 'Erro na migração: ' . $e->getMessage(), 'actions' => $actions]);
    }
}

main();
?>