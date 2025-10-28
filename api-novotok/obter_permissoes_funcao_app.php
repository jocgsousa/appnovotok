<?php
// Configurações de cabeçalho para permitir acesso à API
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Incluir arquivos de configuração
include_once 'database.php';
include_once 'cors_config.php';

// Verificar se a requisição é do tipo GET
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Criar conexão com o banco de dados
    $database = new Database();
    $db = $database->getConnection();

    // Verificar se foi fornecido o ID do aparelho ou o código do aparelho
    if (isset($_GET['aparelho_id']) || isset($_GET['codaparelho'])) {
        $aparelho_id = null;
        
        // Se foi fornecido o código do aparelho, buscar o ID correspondente
        if (isset($_GET['codaparelho'])) {
            $codaparelho = $_GET['codaparelho'];
            
            // Verificar se o aparelho existe
            $query_aparelho = "SELECT id FROM aparelhos WHERE codaparelho = :codaparelho";
            $stmt_aparelho = $db->prepare($query_aparelho);
            $stmt_aparelho->bindParam(':codaparelho', $codaparelho);
            $stmt_aparelho->execute();
            
            if ($stmt_aparelho->rowCount() > 0) {
                $row_aparelho = $stmt_aparelho->fetch(PDO::FETCH_ASSOC);
                $aparelho_id = $row_aparelho['id'];
            } else {
                // Aparelho não encontrado
                http_response_code(404);
                echo json_encode(array("success" => false, "message" => "Aparelho não encontrado."));
                exit();
            }
        } else {
            // Se foi fornecido o ID do aparelho diretamente
            $aparelho_id = $_GET['aparelho_id'];
        }
        
        // Buscar as permissões do aparelho
        $query = "SELECT * FROM controle_acesso_funcao_app WHERE aparelho_id = :aparelho_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':aparelho_id', $aparelho_id);
        $stmt->execute();
        
        if ($stmt->rowCount() > 0) {
            // Permissões encontradas
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Preparar resposta
            $permissoes = array(
                "id" => $row['id'],
                "aparelho_id" => $row['aparelho_id'],
                "orcamentos" => (bool)$row['orcamentos'],
                "minhas_vendas" => (bool)$row['minhas_vendas'],
                "minhas_metas" => (bool)$row['minhas_metas'],
                "informativos" => (bool)$row['informativos'],
                "buscar_produto" => (bool)$row['buscar_produto'],
                "ofertas" => (bool)$row['ofertas'],
                "clientes" => (bool)$row['clientes'],
                "created_at" => $row['created_at'],
                "updated_at" => $row['updated_at']
            );
            
            // Adicionar informações do aparelho
            $query_aparelho_info = "SELECT codaparelho, autorized FROM aparelhos WHERE id = :aparelho_id";
            $stmt_aparelho_info = $db->prepare($query_aparelho_info);
            $stmt_aparelho_info->bindParam(':aparelho_id', $aparelho_id);
            $stmt_aparelho_info->execute();
            
            if ($stmt_aparelho_info->rowCount() > 0) {
                $row_aparelho_info = $stmt_aparelho_info->fetch(PDO::FETCH_ASSOC);
                $permissoes['codaparelho'] = $row_aparelho_info['codaparelho'];
                $permissoes['autorized'] = (bool)$row_aparelho_info['autorized'];
            }
            
            http_response_code(200);
            echo json_encode(array("success" => true, "permissoes" => $permissoes));
        } else {
            // Permissões não encontradas, criar registro padrão
            $query_insert = "INSERT INTO controle_acesso_funcao_app (aparelho_id, orcamentos, minhas_vendas, minhas_metas, informativos, buscar_produto, ofertas, clientes) 
                            VALUES (:aparelho_id, 1, 1, 1, 1, 1, 1, 1)";
            $stmt_insert = $db->prepare($query_insert);
            $stmt_insert->bindParam(':aparelho_id', $aparelho_id);
            
            if ($stmt_insert->execute()) {
                // Buscar as permissões recém-criadas
                $query_new = "SELECT * FROM controle_acesso_funcao_app WHERE aparelho_id = :aparelho_id";
                $stmt_new = $db->prepare($query_new);
                $stmt_new->bindParam(':aparelho_id', $aparelho_id);
                $stmt_new->execute();
                
                if ($stmt_new->rowCount() > 0) {
                    $row_new = $stmt_new->fetch(PDO::FETCH_ASSOC);
                    
                    // Preparar resposta
                    $permissoes = array(
                        "id" => $row_new['id'],
                        "aparelho_id" => $row_new['aparelho_id'],
                        "orcamentos" => (bool)$row_new['orcamentos'],
                        "minhas_vendas" => (bool)$row_new['minhas_vendas'],
                        "minhas_metas" => (bool)$row_new['minhas_metas'],
                        "informativos" => (bool)$row_new['informativos'],
                        "buscar_produto" => (bool)$row_new['buscar_produto'],
                        "ofertas" => (bool)$row_new['ofertas'],
                        "clientes" => (bool)$row_new['clientes'],
                        "created_at" => $row_new['created_at'],
                        "updated_at" => $row_new['updated_at']
                    );
                    
                    // Adicionar informações do aparelho
                    $query_aparelho_info = "SELECT codaparelho, autorized FROM aparelhos WHERE id = :aparelho_id";
                    $stmt_aparelho_info = $db->prepare($query_aparelho_info);
                    $stmt_aparelho_info->bindParam(':aparelho_id', $aparelho_id);
                    $stmt_aparelho_info->execute();
                    
                    if ($stmt_aparelho_info->rowCount() > 0) {
                        $row_aparelho_info = $stmt_aparelho_info->fetch(PDO::FETCH_ASSOC);
                        $permissoes['codaparelho'] = $row_aparelho_info['codaparelho'];
                        $permissoes['autorized'] = (bool)$row_aparelho_info['autorized'];
                    }
                    
                    http_response_code(200);
                    echo json_encode(array(
                        "success" => true, 
                        "permissoes" => $permissoes,
                        "message" => "Permissões padrão criadas com sucesso."
                    ));
                } else {
                    http_response_code(500);
                    echo json_encode(array("success" => false, "message" => "Erro ao recuperar permissões recém-criadas."));
                }
            } else {
                http_response_code(500);
                echo json_encode(array("success" => false, "message" => "Erro ao criar permissões padrão."));
            }
        }
    } else {
        // ID do aparelho ou código não fornecido
        http_response_code(400);
        echo json_encode(array("success" => false, "message" => "É necessário fornecer o ID do aparelho ou o código do aparelho."));
    }
} else {
    // Método de requisição inválido
    http_response_code(405);
    echo json_encode(array("success" => false, "message" => "Método de requisição inválido. Use GET."));
}
?> 