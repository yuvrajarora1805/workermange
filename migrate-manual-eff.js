const mysql = require('mysql2/promise');

async function migrate() {
    const pool = await mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'workermanage',
    });

    console.log('Creating manual_efficiency table...');

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS manual_efficiency (
                id INT AUTO_INCREMENT PRIMARY KEY,
                worker_id INT NOT NULL,
                machine_id INT NOT NULL,
                product_id INT,
                efficiency_pct DECIMAL(5,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_worker_machine_prod (worker_id, machine_id, product_id),
                FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
                FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Success! manual_efficiency table created.');
    } catch (err) {
        console.error('❌ Error creating table:', err.message);
    }

    await pool.end();
}

migrate();
