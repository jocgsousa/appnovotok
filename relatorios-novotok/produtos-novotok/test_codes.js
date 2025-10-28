const { readCodesFromFile } = require('./index.js');
const path = require('path');

async function testCodesReading() {
    console.log('=== TESTE DE LEITURA DO ARQUIVO CODIGOS.TXT ===\n');
    
    try {
        const codesPath = path.join(__dirname, 'codigos.txt');
        console.log(`Caminho do arquivo: ${codesPath}`);
        
        const codes = readCodesFromFile(codesPath);
        
        console.log(`\n=== RESULTADOS ===`);
        console.log(`Total de códigos lidos: ${codes.length}`);
        
        if (codes.length > 0) {
            console.log(`\nPrimeiros 10 códigos:`);
            codes.slice(0, 10).forEach((code, index) => {
                console.log(`  ${index + 1}. ${code}`);
            });
            
            console.log(`\nÚltimos 5 códigos:`);
            codes.slice(-5).forEach((code, index) => {
                const position = codes.length - 5 + index + 1;
                console.log(`  ${position}. ${code}`);
            });
        }
        
        // Verificar se está no range esperado
        if (codes.length >= 2500 && codes.length <= 2600) {
            console.log(`\n✅ SUCESSO: Número de códigos está no range esperado (2500-2600)`);
        } else {
            console.log(`\n⚠️  ATENÇÃO: Número de códigos fora do range esperado (2500-2600)`);
        }
        
    } catch (error) {
        console.error('❌ ERRO no teste:', error.message);
    }
}

// Executar teste
testCodesReading();