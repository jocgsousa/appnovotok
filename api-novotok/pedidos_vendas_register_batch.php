<?php
// Cabeçalhos CORS e dependências
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

// Verificar JWT
$token = get_bearer_token();
if (!$token || !is_jwt_valid($token)) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Token inválido ou expirado."]); 
    exit;
}

// Ler JSON de entrada
$input = file_get_contents('php://input');
$data = json_decode($input, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "JSON inválido.", "error" => json_last_error_msg()]);
    exit;
}

if (!isset($data['pedidos']) || !is_array($data['pedidos']) || count($data['pedidos']) === 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Campo 'pedidos' é obrigatório e deve ser um array não-vazio."]); 
    exit;
}

// Colunas válidas para pedidos_vendas (compatíveis com database.sql)
$pedidoCols = [
    'numped','recarga','dtentrega','tempo_hora','cl_tempo_total','numpedcli','numitens','recebido','endercom','fantasia','codusur2','rca2','codcidade','nomecidade','codpraca','praca','enderent','cgcent','pontorefer','codfornecfrete','numseqentrega','codfornecredespacho','codfuncajud','forneccfrete','fornecdespacho','fretedespacho','dtexportacao','dtimportacao','numviasmapasep','numpedrca','codfilial','codfilialnf','condvenda','data','dtcancel','posicao','codcli','cliente','ufrg','estent','vltotal','vlatend','codusur','numcar','nome','codeemitente','codfunclibera','codfuncconf','codplpag','descricao','prazo1','prazo2','prazo3','prazo4','prazo5','prazo6','prazo7','prazo8','prazo9','prazo10','prazo11','prazo12','prazomedio','obs','obs1','obs2','obsentrega1','obsentrega2','obsentrega3','hora','minuto','codcob','numtransvenda','dtfat','horafat','minutofat','horamon','minutomon','dtlibera','motivoposicao','perclucro','horalib','numpedtv3','codclinf','origemped','dtaberturapedpalm','dtfechamentopedpalm','vlentrada','numpedentfut','numpedweb','numpedmktplace','vldescontocupom','pagamento_aprovado_ciashop','vlbonific','nomeemitente','cmotorista','clnomefunclibera','clnomefuncconf','nomefuncajudante','ccodmotorista','dtsaidacarreg','cplaca','cnumnota','totpeso','utilizavendaporembalagem','horacanc','vlfrete','tot_bonific','aguardandosefaz','totvolume','tipo_transferencia','codigorastreiofretevenda','numcupom','numcaixa'
];

// Colunas válidas para pedidos_vendas_produtos
$itemCols = [
    'numped','numseq','vlipi','percipi','nbm','codprod','descricao','codfab','codsec','codepto','codcategoria','secao','departamento','categoria','numlote','codfuncsep','separadopor','embalagem','qtunitemb','pvendaemb','qt','pvenda','subtotal','st','dtlanc','codfunclanc','rotinalanc','codfuncultalter','rotinaultlalter','dtultlalter','perdesc','vldesc','codfilialretira','pliquido','horacanc','tipoentrega','original','precoriginal','codfornec','fornecedor','codmarca','marca','politicaprioritaria','campbrinde','codauxiliar','percom','bonific','codigobrinde','precomaxconsum','perbonific','perdesccom','descprecofab','descricao7','codusur','nome','codsupervisor','nomesupervisor','qtbloqueada','vlbonific','numpedcli','numitemped','coddeposito','deposito'
];

try {
    $db = (new Database())->getConnection();
    $db->beginTransaction();

    $processed = 0; $inserted = 0; $updated = 0; $itemsProcessed = 0; $itemsInserted = 0; $itemsUpdated = 0; $warnings = [];

    foreach ($data['pedidos'] as $idx => $entry) {
        if (!isset($entry['pedido']) || !is_array($entry['pedido'])) {
            $warnings[] = "Pedido índice {$idx}: campo 'pedido' ausente ou inválido";
            continue;
        }
        $pedido = $entry['pedido'];
        if (!isset($pedido['numped']) || $pedido['numped'] === '') {
            $warnings[] = "Pedido índice {$idx}: 'numped' é obrigatório";
            continue;
        }

        // Filtrar e mapear pedido
        $pedidoData = [];
        foreach ($pedidoCols as $c) { $pedidoData[$c] = array_key_exists($c, $pedido) ? $pedido[$c] : null; }

        // Checar existência
        $stmtCheck = $db->prepare("SELECT id FROM pedidos_vendas WHERE numped = :numped");
        $stmtCheck->execute([':numped' => $pedidoData['numped']]);
        $exists = $stmtCheck->fetchColumn() !== false;

        if ($exists) {
            // Update dinâmico
            $setParts = [];
            foreach ($pedidoCols as $c) { if ($c === 'numped') continue; $setParts[] = "`$c` = :$c"; }
            $sql = "UPDATE pedidos_vendas SET " . implode(', ', $setParts) . " WHERE numped = :numped";
            $stmt = $db->prepare($sql);
            foreach ($pedidoData as $k => $v) { $stmt->bindValue(":$k", $v); }
            $stmt->execute();
            $updated++; $processed++;
        } else {
            // Insert dinâmico
            $cols = implode(',', array_map(fn($c) => "`$c`", $pedidoCols));
            $placeholders = implode(',', array_map(fn($c) => ":$c", $pedidoCols));
            $sql = "INSERT INTO pedidos_vendas ($cols) VALUES ($placeholders)";
            $stmt = $db->prepare($sql);
            foreach ($pedidoData as $k => $v) { $stmt->bindValue(":$k", $v); }
            $stmt->execute();
            $inserted++; $processed++;
        }

        // Processar itens
        if (isset($entry['itens']) && is_array($entry['itens'])) {
            foreach ($entry['itens'] as $i => $item) {
                if (!isset($item['numped']) || !isset($item['numseq'])) {
                    $warnings[] = "Item pedido {$pedidoData['numped']} índice {$i}: 'numped' e 'numseq' obrigatórios";
                    continue;
                }
                $itemData = [];
                foreach ($itemCols as $c) { $itemData[$c] = array_key_exists($c, $item) ? $item[$c] : null; }

                $stmtICheck = $db->prepare("SELECT id FROM pedidos_vendas_produtos WHERE numped = :numped AND numseq = :numseq");
                $stmtICheck->execute([':numped' => $itemData['numped'], ':numseq' => $itemData['numseq']]);
                $iexists = $stmtICheck->fetchColumn() !== false;

                if ($iexists) {
                    $setPartsI = [];
                    foreach ($itemCols as $c) { if (in_array($c, ['numped','numseq'])) continue; $setPartsI[] = "`$c` = :$c"; }
                    $sqlI = "UPDATE pedidos_vendas_produtos SET " . implode(', ', $setPartsI) . " WHERE numped = :numped AND numseq = :numseq";
                    $stmtI = $db->prepare($sqlI);
                    foreach ($itemData as $k => $v) { $stmtI->bindValue(":$k", $v); }
                    $stmtI->execute();
                    $itemsUpdated++; $itemsProcessed++;
                } else {
                    $colsI = implode(',', array_map(fn($c) => "`$c`", $itemCols));
                    $phI = implode(',', array_map(fn($c) => ":$c", $itemCols));
                    $sqlI = "INSERT INTO pedidos_vendas_produtos ($colsI) VALUES ($phI)";
                    $stmtI = $db->prepare($sqlI);
                    foreach ($itemData as $k => $v) { $stmtI->bindValue(":$k", $v); }
                    $stmtI->execute();
                    $itemsInserted++; $itemsProcessed++;
                }
            }
        }
    }

    $db->commit();
    echo json_encode([
        'success' => true,
        'message' => 'Lote de pedidos de vendas processado com sucesso.',
        'total_pedidos' => count($data['pedidos']),
        'processed' => $processed,
        'inserted' => $inserted,
        'updated' => $updated,
        'items_processed' => $itemsProcessed,
        'items_inserted' => $itemsInserted,
        'items_updated' => $itemsUpdated,
        'warnings' => $warnings
    ]);
} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) { $db->rollBack(); }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro no servidor.', 'error' => $e->getMessage()]);
} catch (Exception $e) {
    if (isset($db) && $db->inTransaction()) { $db->rollBack(); }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro inesperado.', 'error' => $e->getMessage()]);
}
?>