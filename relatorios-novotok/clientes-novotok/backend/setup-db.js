const mysql = require('mysql2/promise');

async function createDatabase() {
  try {
    // Create connection without database
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: ''
    });

    // Create database
    await connection.execute('CREATE DATABASE IF NOT EXISTS clientes_novotok CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('✅ Database created successfully!');

    await connection.end();
    
    // Now run migrations
    const { execSync } = require('child_process');
    console.log('Running migrations...');
    execSync('npx sequelize-cli db:migrate', { stdio: 'inherit' });
    console.log('✅ Migrations completed!');
    
    console.log('Running seeders...');
    execSync('npx sequelize-cli db:seed:all', { stdio: 'inherit' });
    console.log('✅ Seeders completed!');
    
    console.log('🎉 Database setup completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createDatabase();