const mysql = require('mysql2/promise');

async function run() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'workermanage'
    });
    try {
        // Remove exact duplicate rows first (keep lowest id)
        await pool.query(`
            DELETE pl1 FROM production_logs pl1
            INNER JOIN production_logs pl2
            WHERE pl1.id > pl2.id
              AND pl1.worker_id = pl2.worker_id
              AND pl1.machine_id = pl2.machine_id
              AND pl1.date = pl2.date
        `);
        console.log('Removed duplicate rows.');

        // Add unique key
        await pool.query(`
            ALTER TABLE production_logs 
            ADD UNIQUE KEY unique_log (worker_id, machine_id, date)
        `);
        console.log('Added unique constraint on (worker_id, machine_id, date).');
    } catch (err) {
        if (err.code === 'ER_DUP_KEYNAME') {
            console.log('Unique constraint already exists.');
        } else {
            console.error(err.message);
        }
    }
    process.exit();
}

run();
