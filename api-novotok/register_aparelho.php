<?php

require_once 'cors_config.php';
// Inclui a classe Database
require_once 'database.php';

// Função para registrar logs
function logRegistro($mensagem) {
    $data = date('Y-m-d H:i:s');
    $logFile = 'logs/register_aparelho.log';
    
    // Cria o diretório de logs se não existir
    if (!is_dir('logs')) {
        mkdir('logs', 0755, true);
    }
    
    // Escreve o log
    file_put_contents($logFile, "[$data] $mensagem\n", FILE_APPEND);
}

// Log inicial para depuração
logRegistro("Iniciando script register_aparelho.php");
logRegistro("Método da requisição: " . $_SERVER['REQUEST_METHOD']);

// Verifica se a requisição é do tipo POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Lê o corpo da requisição JSON
    $inputJSON = file_get_contents('php://input');
    logRegistro("Dados recebidos: " . $inputJSON);
    
    $input = json_decode($inputJSON, true);

    // Verifica se o JSON foi decodificado corretamente
    if ($input === null) {
        logRegistro("Erro ao decodificar JSON: " . json_last_error_msg());
        echo json_encode(['success' => false, 'message' => 'Erro ao decodificar JSON: ' . json_last_error_msg()]);
        exit;
    }

    // Instancia a classe Database
    $database = new Database();
    $conn = $database->getConnection();
    
    if (!$conn) {
        logRegistro("Erro ao conectar com o banco de dados");
        echo json_encode(['success' => false, 'message' => 'Erro ao conectar com o banco de dados']);
        exit;
    }
    
    logRegistro("Conexão com o banco de dados estabelecida");

    // Obtém o valor de codaparelho da requisição JSON
    $codaparelho = isset($input['codaparelho']) ? $input['codaparelho'] : null;
    $useDeviceId = isset($input['use_device_id']) && $input['use_device_id'] === true;
    
    logRegistro("Recebida requisição para registrar aparelho. Código enviado: " . ($codaparelho ?: 'nenhum'));
    logRegistro("Usar ID do dispositivo: " . ($useDeviceId ? 'sim' : 'não'));

    // Verifica se o codaparelho foi enviado
    if ($codaparelho !== null) {
        // Verifica se o codaparelho já existe no banco de dados
        if (codaparelhoExists($conn, $codaparelho)) {
            logRegistro("Aparelho já cadastrado com código: $codaparelho");
            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Aparelho já cadastrado.', 'codaparelho' => $codaparelho]);
            exit;
        } else {
            // Se foi solicitado para usar o ID do dispositivo, sempre usamos o código enviado
            if ($useDeviceId) {
                // Verifica se o código enviado é válido (não vazio e tem pelo menos 4 caracteres)
                if (empty($codaparelho) || strlen($codaparelho) < 4) {
                    logRegistro("Código de dispositivo inválido: $codaparelho. Gerando novo código.");
                    $newCodaparelho = generateRandomNumericCode();
                    
                    // Verifica se o novo código já existe no banco de dados
                    while (codaparelhoExists($conn, $newCodaparelho)) {
                        $newCodaparelho = generateRandomNumericCode();
                    }
                } else {
                    $newCodaparelho = $codaparelho;
                    logRegistro("Usando ID do dispositivo como código: $newCodaparelho");
                }
            } else {
                // Caso contrário, gera um novo código numérico aleatório
                $newCodaparelho = generateRandomNumericCode();
                
                // Verifica se o novo código já existe no banco de dados
                while (codaparelhoExists($conn, $newCodaparelho)) {
                    $newCodaparelho = generateRandomNumericCode();
                }
                
                logRegistro("Gerando novo código aleatório: $newCodaparelho");
            }

            // Obtém o valor de autorized da requisição JSON
            $autorized = isset($input['autorized']) ? $input['autorized'] : 0;

            // Insere o registro no banco de dados
            $sql = "INSERT INTO aparelhos (codaparelho, autorized) VALUES (:codaparelho, :autorized)";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(':codaparelho', $newCodaparelho);
            $stmt->bindParam(':autorized', $autorized);

            if ($stmt->execute()) {
                logRegistro("Novo aparelho registrado com código: $newCodaparelho");
                http_response_code(201);
                echo json_encode(['success' => true, 'message' => 'Aparelho registrado com sucesso!', 'codaparelho' => $newCodaparelho]);
            } else {
                logRegistro("Erro ao registrar aparelho: " . json_encode($stmt->errorInfo()));
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Erro ao registrar aparelho: ' . $stmt->errorInfo()[2]]);
            }
            exit;
        }
    }

    // Se não foi enviado um código, gera um código numérico aleatório
    $codaparelho = generateRandomNumericCode();
    logRegistro("Gerando novo código de aparelho: $codaparelho");

    // Verifica se o código já existe no banco de dados
    while (codaparelhoExists($conn, $codaparelho)) {
        $codaparelho = generateRandomNumericCode();
        logRegistro("Código já existe, gerando novo: $codaparelho");
    }

    // Obtém o valor de autorized da requisição JSON
    $autorized = isset($input['autorized']) ? $input['autorized'] : 0;

    // Insere o registro no banco de dados
    $sql = "INSERT INTO aparelhos (codaparelho, autorized) VALUES (:codaparelho, :autorized)";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':codaparelho', $codaparelho);
    $stmt->bindParam(':autorized', $autorized);

    try {
        if ($stmt->execute()) {
            logRegistro("Aparelho registrado com sucesso: $codaparelho");
            http_response_code(201);
            echo json_encode(['success' => true, 'message' => 'Aparelho registrado com sucesso!', 'codaparelho' => $codaparelho]);
        } else {
            logRegistro("Erro ao registrar aparelho: " . json_encode($stmt->errorInfo()));
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao registrar aparelho: ' . $stmt->errorInfo()[2]]);
        }
    } catch (PDOException $e) {
        logRegistro("Exceção PDO ao registrar aparelho: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro ao registrar aparelho: ' . $e->getMessage()]);
    }
} else {
    logRegistro("Método de requisição inválido: " . $_SERVER['REQUEST_METHOD']);
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método de requisição inválido. Use POST.']);
}

// Função para gerar um código numérico aleatório
function generateRandomNumericCode($length = 8) {
    $characters = '0123456789';
    $charactersLength = strlen($characters);
    $randomCode = '';
    for ($i = 0; $i < $length; $i++) {
        $randomCode .= $characters[rand(0, $charactersLength - 1)];
    }
    return $randomCode;
}

// Função para verificar se o código já existe no banco de dados
function codaparelhoExists($conn, $codaparelho) {
    $sql = "SELECT id FROM aparelhos WHERE codaparelho = :codaparelho";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':codaparelho', $codaparelho);
    $stmt->execute();
    return $stmt->rowCount() > 0;
}
?>