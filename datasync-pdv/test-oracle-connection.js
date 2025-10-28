require("dotenv/config");
const oracledb = require("oracledb");
const path = require("path");

// Configuração do caminho do Oracle Client
const oracleClientPath = path.resolve(__dirname, "instantclient_19_25");
oracledb.initOracleClient({ libDir: oracleClientPath });

async function testConnection() {
  let connection;
  
  try {
    console.log('🔍 Testando conexão Oracle Database...');
    console.log(`📍 Host: ${process.env.LCDBHOST}`);
    console.log(`👤 Usuário: ${process.env.LCDBUSER}`);
    console.log(`🗄️ Database: ${process.env.LCDBNAME}`);
    console.log('');
    
    connection = await oracledb.getConnection({
      user: process.env.LCDBUSER,
      password: process.env.LCDBPASS,
      connectString: `${process.env.LCDBHOST}/${process.env.LCDBNAME}`,
    });
    
    console.log('✅ Conexão Oracle estabelecida com sucesso!');
    
    // Teste simples de query
    const result = await connection.execute('SELECT SYSDATE FROM DUAL');
    console.log('📅 Data do servidor Oracle:', result.rows[0][0]);
    
    // Teste de tabela específica se existir
    try {
      const tableTest = await connection.execute(`
        SELECT COUNT(*) as total FROM PCCLIENT WHERE ROWNUM <= 1
      `);
      console.log('📊 Tabela PCCLIENT acessível:', tableTest.rows[0][0] >= 0 ? 'SIM' : 'NÃO');
    } catch (tableError) {
      console.log('⚠️ Tabela PCCLIENT não encontrada ou sem permissão');
    }
    
    console.log('');
    console.log('🎉 Teste de conexão concluído com sucesso!');
    
  } catch (error) {
    console.log('❌ Erro na conexão Oracle:');
    console.log(`   Código: ${error.errorNum || 'N/A'}`);
    console.log(`   Mensagem: ${error.message}`);
    console.log('');
    
    if (error.message.includes('ORA-12631') || error.message.includes('ORA-12638')) {
      console.log('💡 SOLUÇÃO SUGERIDA:');
      console.log('   1. Execute: fix-oracle-auth.bat');
      console.log('   2. Ou copie manualmente sqlnet.ora para instantclient_19_25/');
      console.log('   3. Reinicie a aplicação');
    } else if (error.message.includes('ORA-12541')) {
      console.log('💡 SOLUÇÃO SUGERIDA:');
      console.log('   - Verifique se o servidor Oracle está rodando');
      console.log('   - Confirme o host/porta no .env');
    } else if (error.message.includes('ORA-01017')) {
      console.log('💡 SOLUÇÃO SUGERIDA:');
      console.log('   - Verifique usuário/senha no .env');
    }
    
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('🔐 Conexão Oracle fechada.');
      } catch (closeError) {
        console.log('⚠️ Erro ao fechar conexão:', closeError.message);
      }
    }
  }
}

testConnection();