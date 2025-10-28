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
include_once 'jwt_utils.php';

// Importar classes necessárias para JWT
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

// Chave secreta para JWT (mesma usada em jwt_utils.php)
define('SECRET_KEY', '99ee8b4be05b1ee4e6706bebb04624c5');

// Verificar se a requisição é do tipo GET
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Verificar token JWT para autenticação
    $jwt = getBearerToken();
    
    if (!$jwt) {
        http_response_code(401);
        echo json_encode(array("success" => false, "message" => "Token de acesso não fornecido."));
        exit();
    }
    
    try {
        // Validar o token usando a chave secreta definida
        $decoded = JWT::decode($jwt, new Key(SECRET_KEY, 'HS256'));
        
        // Verificar se o usuário é administrador
        if ($decoded->data->tipo_usuario !== 'admin' && $decoded->data->tipo_usuario !== 'gestor') {
            http_response_code(403);
            echo json_encode(array("success" => false, "message" => "Acesso negado. Apenas administradores e gestores podem listar todas as permissões."));
            exit();
        }
        
        // Criar conexão com o banco de dados
        $database = new Database();
        $db = $database->getConnection();
        
        // Consulta para obter todas as permissões com informações dos aparelhos
        $query = "SELECT p.*, a.codaparelho, a.autorized, 
                    COALESCE(v.nome, 'Não vinculado') as vendedor_nome, 
                    COALESCE(v.rca, '') as vendedor_rca
                  FROM controle_acesso_funcao_app p
                  JOIN aparelhos a ON p.aparelho_id = a.id
                  LEFT JOIN vendedores v ON a.vendedor_id = v.id
                  ORDER BY a.id";
        
        $stmt = $db->prepare($query);
        $stmt->execute();
        
        if ($stmt->rowCount() > 0) {
            // Array para armazenar os resultados
            $permissoes_arr = array();
            
            // Recuperar os resultados
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $permissao_item = array(
                    "id" => $row['id'],
                    "aparelho_id" => $row['aparelho_id'],
                    "codaparelho" => $row['codaparelho'],
                    "autorized" => (bool)$row['autorized'],
                    "vendedor" => array(
                        "nome" => $row['vendedor_nome'],
                        "rca" => $row['vendedor_rca']
                    ),
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
                
                array_push($permissoes_arr, $permissao_item);
            }
            
            http_response_code(200);
            echo json_encode(array("success" => true, "permissoes" => $permissoes_arr));
        } else {
            http_response_code(200);
            echo json_encode(array("success" => true, "permissoes" => array(), "message" => "Nenhuma permissão encontrada."));
        }
        
    } catch (Exception $e) {
        http_response_code(401);
        echo json_encode(array(
            "success" => false,
            "message" => "Token inválido ou expirado.",
            "error" => $e->getMessage()
        ));
    }
} else {
    // Método de requisição inválido
    http_response_code(405);
    echo json_encode(array("success" => false, "message" => "Método de requisição inválido. Use GET."));
}

// Função para obter o token Bearer do cabeçalho
function getBearerToken() {
    $headers = null;
    if (isset($_SERVER['Authorization'])) {
        $headers = trim($_SERVER["Authorization"]);
    } else if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER["HTTP_AUTHORIZATION"]);
    } elseif (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
        if (isset($requestHeaders['Authorization'])) {
            $headers = trim($requestHeaders['Authorization']);
        }
    }
    
    if (!empty($headers)) {
        if (preg_match('/Bearer\s(\S+)/', $headers, $matches)) {
            return $matches[1];
        }
    }
    
    return null;
}
?> 