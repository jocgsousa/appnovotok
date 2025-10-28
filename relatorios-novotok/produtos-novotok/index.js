const oracledb = require('oracledb');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configurar o Oracle Instant Client
oracledb.initOracleClient({ libDir: path.join(__dirname, 'instantclient_19_25') });

// Função para ler configurações do Oracle
function loadOracleConfig() {
    try {
        const configData = fs.readFileSync(path.join(__dirname, 'oracle.json'), 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('Erro ao ler configurações do Oracle:', error);
        throw error;
    }
}

// Função para ler códigos do arquivo codigos.txt
function readCodesFromFile(filePath) {
    try {
        console.log('Lendo códigos do arquivo codigos.txt...');
        
        // Ler o arquivo de texto
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Dividir por linhas e filtrar códigos válidos
        const codes = fileContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !isNaN(line) && line !== '')
            .map(line => line.toString());
        
        // Remover duplicatas (caso existam)
        const uniqueCodes = [...new Set(codes)];
        
        console.log(`Total de códigos únicos encontrados: ${uniqueCodes.length}`);
        
        return uniqueCodes;
    } catch (error) {
        console.error('Erro ao ler arquivo de códigos:', error.message);
        throw error;
    }
}

// Função para executar consulta SQL para um código específico
async function queryProductData(connection, codProd) {
    const sql = `
        WITH dados_base AS (
          SELECT PCPRODUT.CODPROD,
                 PCPRODUT.DESCRICAO,
                 PCEST.CODFILIAL,
                 PCEST.QTESTGER,
                 PCEST.QTPEDIDA
          FROM PCPRODUT
             , PCEST
             , PCFORNEC
             , PCCONSUM
             , PCPRODFILIAL
         WHERE PCPRODUT.CODPROD = PCEST.CODPROD
           AND PCEST.CODPROD = PCPRODFILIAL.CODPROD
           AND PCEST.CODFILIAL = PCPRODFILIAL.CODFILIAL
           AND PCPRODUT.CODFORNEC = PCFORNEC.CODFORNEC
           AND ((PCPRODUT.CODFILIAL = PCEST.CODFILIAL) OR (PCPRODUT.CODFILIAL = '99') OR (PCPRODUT.CODFILIAL IS NULL))
           AND PCEST.CODFILIAL IN ('1','2','3','4','5','6','7','8')
           AND NVL(PCPRODUT.CODPRODPRINC, PCPRODUT.CODPROD) = PCPRODUT.CODPROD
           AND PCPRODUT.CODPROD = :CODPROD
        )
        SELECT 
            CODPROD,
            DESCRICAO,
            MAX(CASE WHEN CODFILIAL = '1' THEN QTESTGER END) AS ESTOQUE_ATUAL_1,
            MAX(CASE WHEN CODFILIAL = '2' THEN QTESTGER END) AS ESTOQUE_ATUAL_2,
            MAX(CASE WHEN CODFILIAL = '3' THEN QTESTGER END) AS ESTOQUE_ATUAL_3,
            MAX(CASE WHEN CODFILIAL = '4' THEN QTESTGER END) AS ESTOQUE_ATUAL_4,
            MAX(CASE WHEN CODFILIAL = '5' THEN QTESTGER END) AS ESTOQUE_ATUAL_5,
            MAX(CASE WHEN CODFILIAL = '6' THEN QTESTGER END) AS ESTOQUE_ATUAL_6,
            MAX(CASE WHEN CODFILIAL = '7' THEN QTESTGER END) AS ESTOQUE_ATUAL_7,
            MAX(CASE WHEN CODFILIAL = '8' THEN QTESTGER END) AS ESTOQUE_ATUAL_8,
            MAX(CASE WHEN CODFILIAL = '1' THEN QTPEDIDA END) AS QTPEDIDA_1,
            MAX(CASE WHEN CODFILIAL = '2' THEN QTPEDIDA END) AS QTPEDIDA_2,
            MAX(CASE WHEN CODFILIAL = '3' THEN QTPEDIDA END) AS QTPEDIDA_3,
            MAX(CASE WHEN CODFILIAL = '4' THEN QTPEDIDA END) AS QTPEDIDA_4,
            MAX(CASE WHEN CODFILIAL = '5' THEN QTPEDIDA END) AS QTPEDIDA_5,
            MAX(CASE WHEN CODFILIAL = '6' THEN QTPEDIDA END) AS QTPEDIDA_6,
            MAX(CASE WHEN CODFILIAL = '7' THEN QTPEDIDA END) AS QTPEDIDA_7,
            MAX(CASE WHEN CODFILIAL = '8' THEN QTPEDIDA END) AS QTPEDIDA_8
        FROM dados_base
        GROUP BY CODPROD, DESCRICAO
        ORDER BY DESCRICAO
    `;

    try {
        const result = await connection.execute(sql, { CODPROD: codProd });
        return result.rows;
    } catch (error) {
        console.error(`Erro ao consultar produto ${codProd}:`, error);
        return [];
    }
}

// Função para criar arquivo Excel com os resultados
function createResultExcel(data, outputPath) {
    try {
        // Definir cabeçalhos
        const headers = [
            'CODPROD', 'DESCRICAO',
            'ESTOQUE_ATUAL_1', 'ESTOQUE_ATUAL_2', 'ESTOQUE_ATUAL_3', 'ESTOQUE_ATUAL_4',
            'ESTOQUE_ATUAL_5', 'ESTOQUE_ATUAL_6', 'ESTOQUE_ATUAL_7', 'ESTOQUE_ATUAL_8',
            'QTPEDIDA_1', 'QTPEDIDA_2', 'QTPEDIDA_3', 'QTPEDIDA_4',
            'QTPEDIDA_5', 'QTPEDIDA_6', 'QTPEDIDA_7', 'QTPEDIDA_8'
        ];

        // Preparar dados para o Excel
        const excelData = [headers, ...data];

        // Criar workbook e worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(excelData);

        // Adicionar worksheet ao workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos');

        // Salvar arquivo
        XLSX.writeFile(workbook, outputPath);
        console.log(`Arquivo Excel criado: ${outputPath}`);
    } catch (error) {
        console.error('Erro ao criar arquivo Excel:', error);
        throw error;
    }
}

// Função principal
async function main() {
    let connection;
    
    try {
        console.log('Iniciando processamento...');
        
        // Carregar configurações do Oracle
        const oracleConfig = loadOracleConfig();
        
        // Ler códigos do arquivo codigos.txt
        const codesPath = path.join(__dirname, 'codigos.txt');
        const codes = readCodesFromFile(codesPath);
        
        if (codes.length === 0) {
            console.log('Nenhum código encontrado no arquivo Excel');
            return;
        }

        // Conectar ao Oracle
        console.log('Conectando ao Oracle...');
        connection = await oracledb.getConnection({
            user: oracleConfig.user,
            password: oracleConfig.password,
            connectString: `${oracleConfig.host}/${oracleConfig.database}`
        });
        
        console.log('Conexão estabelecida com sucesso!');

        // Processar cada código
        const allResults = [];
        let processedCount = 0;
        
        for (const code of codes) {
            console.log(`Processando código ${code} (${processedCount + 1}/${codes.length})`);
            
            const results = await queryProductData(connection, code);
            if (results.length > 0) {
                allResults.push(...results);
            }
            
            processedCount++;
            
            // Pequena pausa para não sobrecarregar o banco
            if (processedCount % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`Processamento concluído. ${allResults.length} registros encontrados.`);

        // Criar arquivo Excel com os resultados
        if (allResults.length > 0) {
            const outputPath = path.join(__dirname, 'produtos_resultado.xlsx');
            createResultExcel(allResults, outputPath);
            console.log(`Relatório gerado com sucesso: ${outputPath}`);
        } else {
            console.log('Nenhum resultado encontrado para os códigos processados.');
        }

    } catch (error) {
        console.error('Erro durante o processamento:', error);
    } finally {
        // Fechar conexão
        if (connection) {
            try {
                await connection.close();
                console.log('Conexão com Oracle fechada.');
            } catch (error) {
                console.error('Erro ao fechar conexão:', error);
            }
        }
    }
}

// Executar o script
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main, readCodesFromFile, queryProductData, createResultExcel };