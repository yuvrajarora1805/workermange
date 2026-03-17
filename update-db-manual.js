const mysql = require('mysql2/promise');

async function run() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'workermanage'
    });
    try {
        await pool.query('ALTER TABLE daily_assignments ADD COLUMN is_manual TINYINT(1) DEFAULT 0');
        console.log('Added is_manual column successfully.');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Column already exists.');
        } else {
            console.error(err);
        }
    }
    process.exit();
}

run();
