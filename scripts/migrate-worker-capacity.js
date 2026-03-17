const mysql = require('mysql2/promise');

async function run() {
    const pool = mysql.createPool({ host:'localhost', user:'root', password:'', database:'workermanage' });

    console.log('🔄 Starting migration for numeric worker capacity...');

    try {
        // 1. Rename allow_multiple_workers to worker_capacity and change to INT
        // If allow_multiple_workers existed, we set worker_capacity to 2 if it was 1, else 1.
        // Actually simplest is just to drop and add or modify.
        
        const [columns] = await pool.query("SHOW COLUMNS FROM machines LIKE 'allow_multiple_workers'");
        
        if (columns.length > 0) {
            await pool.query("ALTER TABLE machines CHANGE COLUMN allow_multiple_workers worker_capacity INT DEFAULT 1");
            // Set existing 'multiple' machines to a reasonable default like 2
            await pool.query("UPDATE machines SET worker_capacity = 2 WHERE worker_capacity = 1");
            // And 'single' machines to 1 (they were 0 previously)
             await pool.query("UPDATE machines SET worker_capacity = 1 WHERE worker_capacity = 0");
            console.log('✅ Renamed allow_multiple_workers to worker_capacity and updated values');
        } else {
            const [capCol] = await pool.query("SHOW COLUMNS FROM machines LIKE 'worker_capacity'");
            if (capCol.length === 0) {
                await pool.query("ALTER TABLE machines ADD COLUMN worker_capacity INT DEFAULT 1 AFTER is_active");
                console.log('✅ Added worker_capacity column to machines');
            } else {
                console.log('⚠️  worker_capacity column already exists');
            }
        }
    } catch (err) {
        console.error('❌ Error during migration:', err.message);
    }

    console.log('\nMigration Done!');
    process.exit();
}

run();
