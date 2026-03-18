const mysql = require('mysql2/promise');

async function migrate() {
    const pool = await mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'workermanage',
    });

    console.log('Adding "gender" column to "workers" table...');

    try {
        // Check if column exists first
        const [columns] = await pool.query('SHOW COLUMNS FROM workers LIKE "gender"');
        
        if (columns.length === 0) {
            await pool.query('ALTER TABLE workers ADD COLUMN gender VARCHAR(20) DEFAULT NULL AFTER employee_id');
            console.log('✅ Success! "gender" column added.');
        } else {
            console.log('ℹ️ Column "gender" already exists.');
        }
    } catch (err) {
        console.error('❌ Error adding column:', err.message);
    }

    await pool.end();
}

migrate();
