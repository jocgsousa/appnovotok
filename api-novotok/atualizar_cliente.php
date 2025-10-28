<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

// Definir cabeçalho para resposta JSON
header('Content-Type: application/json');

// Verificar se a requisição é PUT
if ($_SERVER['REQUEST_METHOD'] !== 'PUT' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit;
}

// Receber dados do corpo da requisição
$data = json_decode(file_get_contents('php://input'), true);

// Verificar se o ID do cliente foi fornecido
if (!isset($data['id']) || empty($data['id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID do cliente não fornecido']);
    exit;
}

// Verificar se o ID é um número inteiro válido
if (!is_numeric($data['id']) || intval($data['id']) <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID do cliente inválido']);
    exit;
}

// Verificar se os dados necessários foram fornecidos
$campos_obrigatorios = ['name', 'person_identification_number', 'email', 'billingPhone', 'commercial_address', 
                       'commercial_address_number', 'business_district', 'business_city'];

$campos_faltando = [];
foreach ($campos_obrigatorios as $campo) {
    if (!isset($data[$campo]) || empty($data[$campo])) {
        $campos_faltando[] = $campo;
    }
}

if (!empty($campos_faltando)) {
    http_response_code(400);
    echo json_encode([
        'success' => false, 
        'message' => 'Campos obrigatórios não fornecidos: ' . implode(', ', $campos_faltando)
    ]);
    exit;
}

try {
    // Inicializar a conexão com o banco de dados
    $database = new Database();
    $conn = $database->getConnection();
    
    // Verificar se o cliente existe
    $stmt = $conn->prepare("SELECT id FROM clientes WHERE id = :id LIMIT 1");
    $stmt->bindParam(':id', $data['id']);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Cliente não encontrado']);
        exit;
    }
    
    // Verificar se o CPF/CNPJ já está em uso por outro cliente
    $stmt = $conn->prepare("SELECT id FROM clientes WHERE person_identification_number = :person_identification_number AND id != :id LIMIT 1");
    $stmt->bindParam(':person_identification_number', $data['person_identification_number']);
    $stmt->bindParam(':id', $data['id']);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        http_response_code(409);
        echo json_encode([
            'success' => false, 
            'message' => 'Este CPF/CNPJ já está em uso por outro cliente',
            'error' => 'duplicate_entry'
        ]);
        exit;
    }
    
    // Limpar o CPF/CNPJ para manter apenas números
    $person_identification_number_clean = preg_replace('/[^0-9]/', '', $data['person_identification_number']);
    
    // Usar o valor de corporate enviado pelo cliente ao invés de determinar pelo tamanho do CPF/CNPJ
    $corporate = isset($data['corporate']) ? (bool)$data['corporate'] : false;
    
    // Preparar os dados para atualização
    $sql = "UPDATE clientes SET
            corporate = :corporate,
            name = :name,
            trade_name = :trade_name,
            person_identification_number = :person_identification_number,
            state_inscription = :state_inscription,
            commercial_address = :commercial_address,
            commercial_address_number = :commercial_address_number,
            business_district = :business_district,
            commercial_zip_code = :commercial_zip_code,
            billingPhone = :billingPhone,
            email = :email,
            email_nfe = :email_nfe,
            activity_id = :activity_id,
            business_city = :business_city,
            city_id = :city_id,
            filial = :filial,
            rca = :rca,
            data_nascimento = :data_nascimento,
            updated_at = NOW(),
            atualizado = 1,
            recused = :recused,
            recused_msg = :recused_msg,
            registered = :registered,
            authorized = :authorized,
            billing_id = :billing_id,
            square_id = :square_id
            WHERE id = :id";

    $stmt = $conn->prepare($sql);
    
    // Vincular parâmetros
    $stmt->bindParam(':corporate', $corporate, PDO::PARAM_BOOL);
    $stmt->bindParam(':name', $data['name']);
    
    // Corrigir o problema de trade_name que pode ser null
    $trade_name = isset($data['trade_name']) ? $data['trade_name'] : null;
    $stmt->bindParam(':trade_name', $trade_name);
    
    $stmt->bindParam(':person_identification_number', $person_identification_number_clean);
    $stmt->bindParam(':state_inscription', $data['state_inscription']);
    $stmt->bindParam(':commercial_address', $data['commercial_address']);
    $stmt->bindParam(':commercial_address_number', $data['commercial_address_number']);
    $stmt->bindParam(':business_district', $data['business_district']);
    
    // Corrigir o problema de commercial_zip_code que pode ser vazio
    $commercial_zip_code = isset($data['commercial_zip_code']) ? $data['commercial_zip_code'] : '';
    $stmt->bindParam(':commercial_zip_code', $commercial_zip_code);
    
    $stmt->bindParam(':billingPhone', $data['billingPhone']);
    $stmt->bindParam(':email', $data['email']);
    $stmt->bindParam(':email_nfe', $data['email_nfe']);
    
    // Corrigir o problema de activity_id que pode ser null
    $activity_id = isset($data['activity_id']) ? $data['activity_id'] : null;
    $stmt->bindParam(':activity_id', $activity_id);
    
    $stmt->bindParam(':business_city', $data['business_city']);
    
    // Corrigir o problema de city_id que pode ser null
    $city_id = isset($data['city_id']) ? $data['city_id'] : null;
    $stmt->bindParam(':city_id', $city_id);
    
    // Corrigir o problema de filial que pode ser null
    $filial = isset($data['filial']) ? $data['filial'] : null;
    $stmt->bindParam(':filial', $filial);
    
    // Corrigir o problema de rca que pode ser null
    $rca = isset($data['rca']) ? $data['rca'] : null;
    $stmt->bindParam(':rca', $rca);
    
    // Converter data de nascimento para formato MySQL se fornecida
    $data_nascimento = null;
    if (!empty($data['data_nascimento'])) {
        $data_nascimento_parts = explode('/', $data['data_nascimento']);
        if (count($data_nascimento_parts) === 3) {
            $data_nascimento = $data_nascimento_parts[2] . '-' . $data_nascimento_parts[1] . '-' . $data_nascimento_parts[0];
        }
    }
    $stmt->bindParam(':data_nascimento', $data_nascimento);
    
    // Vincular novos parâmetros para recused e recused_msg
    $recused = isset($data['recused']) ? (bool)$data['recused'] : false;
    $recused_msg = isset($data['recused_msg']) ? $data['recused_msg'] : '';
    $stmt->bindParam(':recused', $recused, PDO::PARAM_BOOL);
    $stmt->bindParam(':recused_msg', $recused_msg);
    
    // Vincular parâmetros para registered e authorized
    $registered = isset($data['registered']) ? (bool)$data['registered'] : false;
    $authorized = isset($data['authorized']) ? (bool)$data['authorized'] : false;
    $stmt->bindParam(':registered', $registered, PDO::PARAM_BOOL);
    $stmt->bindParam(':authorized', $authorized, PDO::PARAM_BOOL);
    
    // Vincular parâmetros para billing_id e square_id
    $billing_id = isset($data['billing_id']) ? $data['billing_id'] : 'D';
    $square_id = isset($data['square_id']) ? $data['square_id'] : '1';
    $stmt->bindParam(':billing_id', $billing_id);
    $stmt->bindParam(':square_id', $square_id);
    
    // Vincular o parâmetro id na cláusula WHERE
    $stmt->bindParam(':id', $data['id']);
    
    // Executar a atualização
    if ($stmt->execute()) {
        // Registrar log da operação
        error_log("Cliente atualizado: ID={$data['id']}, Nome={$data['name']}, CPF/CNPJ={$data['person_identification_number']}");
        
        echo json_encode([
            'success' => true,
            'message' => 'Cliente atualizado com sucesso',
            'id' => $data['id']
        ]);
    } else {
        throw new Exception('Erro ao atualizar cliente');
    }
    
} catch (PDOException $e) {
    error_log("Erro PDO ao atualizar cliente: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao atualizar cliente: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Erro ao atualizar cliente: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 