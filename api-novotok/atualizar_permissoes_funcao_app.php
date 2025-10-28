<?php
// Configurações de cabeçalho para permitir acesso à API
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Incluir arquivos de configuração
include_once 'database.php';
include_once 'cors_config.php';

// Verificar se a requisição é do tipo POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Receber dados do corpo da requisição
    $data = json_decode(file_get_contents("php://input"));
    
    // Verificar se todos os dados necessários foram fornecidos
    if (
        !empty($data->aparelho_id) &&
        isset($data->orcamentos) &&
        isset($data->minhas_vendas) &&
        isset($data->minhas_metas) &&
        isset($data->informativos) &&
        isset($data->buscar_produto) &&
        isset($data->ofertas) &&
        isset($data->clientes)
    ) {
        // Criar conexão com o banco de dados
        $database = new Database();
        $db = $database->getConnection();
        
        // Verificar se o aparelho existe
        $query_aparelho = "SELECT id FROM aparelhos WHERE id = :aparelho_id";
        $stmt_aparelho = $db->prepare($query_aparelho);
        $stmt_aparelho->bindParam(':aparelho_id', $data->aparelho_id);
        $stmt_aparelho->execute();
        
        if ($stmt_aparelho->rowCount() > 0) {
            // Verificar se já existem permissões para este aparelho
            $query_check = "SELECT id FROM controle_acesso_funcao_app WHERE aparelho_id = :aparelho_id";
            $stmt_check = $db->prepare($query_check);
            $stmt_check->bindParam(':aparelho_id', $data->aparelho_id);
            $stmt_check->execute();
            
            if ($stmt_check->rowCount() > 0) {
                // Atualizar permissões existentes
                $query = "UPDATE controle_acesso_funcao_app SET 
                            orcamentos = :orcamentos,
                            minhas_vendas = :minhas_vendas,
                            minhas_metas = :minhas_metas,
                            informativos = :informativos,
                            buscar_produto = :buscar_produto,
                            ofertas = :ofertas,
                            clientes = :clientes
                          WHERE aparelho_id = :aparelho_id";
                
                $stmt = $db->prepare($query);
                
                // Converter valores booleanos para inteiros (0 ou 1)
                $orcamentos = $data->orcamentos ? 1 : 0;
                $minhas_vendas = $data->minhas_vendas ? 1 : 0;
                $minhas_metas = $data->minhas_metas ? 1 : 0;
                $informativos = $data->informativos ? 1 : 0;
                $buscar_produto = $data->buscar_produto ? 1 : 0;
                $ofertas = $data->ofertas ? 1 : 0;
                $clientes = $data->clientes ? 1 : 0;
                
                // Vincular parâmetros
                $stmt->bindParam(':aparelho_id', $data->aparelho_id);
                $stmt->bindParam(':orcamentos', $orcamentos);
                $stmt->bindParam(':minhas_vendas', $minhas_vendas);
                $stmt->bindParam(':minhas_metas', $minhas_metas);
                $stmt->bindParam(':informativos', $informativos);
                $stmt->bindParam(':buscar_produto', $buscar_produto);
                $stmt->bindParam(':ofertas', $ofertas);
                $stmt->bindParam(':clientes', $clientes);
                
                // Executar a query
                if ($stmt->execute()) {
                    // Buscar as permissões atualizadas
                    $query_updated = "SELECT * FROM controle_acesso_funcao_app WHERE aparelho_id = :aparelho_id";
                    $stmt_updated = $db->prepare($query_updated);
                    $stmt_updated->bindParam(':aparelho_id', $data->aparelho_id);
                    $stmt_updated->execute();
                    
                    if ($stmt_updated->rowCount() > 0) {
                        $row = $stmt_updated->fetch(PDO::FETCH_ASSOC);
                        
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
                        
                        http_response_code(200);
                        echo json_encode(array(
                            "success" => true, 
                            "message" => "Permissões atualizadas com sucesso.",
                            "permissoes" => $permissoes
                        ));
                    } else {
                        http_response_code(500);
                        echo json_encode(array("success" => false, "message" => "Erro ao recuperar permissões atualizadas."));
                    }
                } else {
                    http_response_code(500);
                    echo json_encode(array("success" => false, "message" => "Erro ao atualizar permissões."));
                }
            } else {
                // Criar novo registro de permissões
                $query = "INSERT INTO controle_acesso_funcao_app (
                            aparelho_id, orcamentos, minhas_vendas, minhas_metas, informativos, buscar_produto, ofertas, clientes
                          ) VALUES (
                            :aparelho_id, :orcamentos, :minhas_vendas, :minhas_metas, :informativos, :buscar_produto, :ofertas, :clientes
                          )";
                
                $stmt = $db->prepare($query);
                
                // Converter valores booleanos para inteiros (0 ou 1)
                $orcamentos = $data->orcamentos ? 1 : 0;
                $minhas_vendas = $data->minhas_vendas ? 1 : 0;
                $minhas_metas = $data->minhas_metas ? 1 : 0;
                $informativos = $data->informativos ? 1 : 0;
                $buscar_produto = $data->buscar_produto ? 1 : 0;
                $ofertas = $data->ofertas ? 1 : 0;
                $clientes = $data->clientes ? 1 : 0;
                
                // Vincular parâmetros
                $stmt->bindParam(':aparelho_id', $data->aparelho_id);
                $stmt->bindParam(':orcamentos', $orcamentos);
                $stmt->bindParam(':minhas_vendas', $minhas_vendas);
                $stmt->bindParam(':minhas_metas', $minhas_metas);
                $stmt->bindParam(':informativos', $informativos);
                $stmt->bindParam(':buscar_produto', $buscar_produto);
                $stmt->bindParam(':ofertas', $ofertas);
                $stmt->bindParam(':clientes', $clientes);
                
                // Executar a query
                if ($stmt->execute()) {
                    // Buscar as permissões recém-criadas
                    $query_new = "SELECT * FROM controle_acesso_funcao_app WHERE aparelho_id = :aparelho_id";
                    $stmt_new = $db->prepare($query_new);
                    $stmt_new->bindParam(':aparelho_id', $data->aparelho_id);
                    $stmt_new->execute();
                    
                    if ($stmt_new->rowCount() > 0) {
                        $row = $stmt_new->fetch(PDO::FETCH_ASSOC);
                        
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
                        
                        http_response_code(201);
                        echo json_encode(array(
                            "success" => true, 
                            "message" => "Permissões criadas com sucesso.",
                            "permissoes" => $permissoes
                        ));
                    } else {
                        http_response_code(500);
                        echo json_encode(array("success" => false, "message" => "Erro ao recuperar permissões recém-criadas."));
                    }
                } else {
                    http_response_code(500);
                    echo json_encode(array("success" => false, "message" => "Erro ao criar permissões."));
                }
            }
        } else {
            // Aparelho não encontrado
            http_response_code(404);
            echo json_encode(array("success" => false, "message" => "Aparelho não encontrado."));
        }
    } else {
        // Dados incompletos
        http_response_code(400);
        echo json_encode(array("success" => false, "message" => "Não foi possível atualizar as permissões. Dados incompletos."));
    }
} else {
    // Método de requisição inválido
    http_response_code(405);
    echo json_encode(array("success" => false, "message" => "Método de requisição inválido. Use POST."));
}
?> 