const mysql = require('mysql2/promise');

async function run() {
    const pool = mysql.createPool({ host:'localhost', user:'root', password:'', database:'workermanage' });

    console.log('Starting attendance shift migration...');

    try {
        // 1. Add shift column to attendance
        try {
            await pool.query("ALTER TABLE attendance ADD COLUMN shift ENUM('day','night') NOT NULL DEFAULT 'day'");
            console.log('✅ Added shift column to attendance');
        } catch (e) { console.log('⚠️  Shift column might already exist'); }

        // 2. Drop unique constraint (worker_id, date)
        // Usually, in MySQL, the constraint name for a unique key is often the column name or assigned name.
        // Let's find the constraint name.
        const [fks] = await pool.query(`
            SELECT CONSTRAINT_NAME 
            FROM information_schema.TABLE_CONSTRAINTS 
            WHERE CONSTRAINT_SCHEMA='workermanage' 
              AND TABLE_NAME='attendance' 
              AND CONSTRAINT_TYPE='UNIQUE'
        `);
        
        for (const fk of fks) {
            try {
                await pool.query(`ALTER TABLE attendance DROP INDEX ${fk.CONSTRAINT_NAME}`);
                console.log(`✅ Dropped unique index ${fk.CONSTRAINT_NAME}`);
            } catch (e) { console.log(`⚠️  Could not drop index ${fk.CONSTRAINT_NAME}`); }
        }

        // Also check for 'unique_worker_date' or similar common names if information_schema query was too specific
        try {
            await pool.query("ALTER TABLE attendance DROP INDEX worker_id_2"); // Common auto-name
        } catch (e) {}
        try {
            await pool.query("ALTER TABLE attendance DROP INDEX worker_id"); // If it was just worker_id
        } catch (e) {}

        // 3. Add new unique index with shift
        await pool.query("ALTER TABLE attendance ADD UNIQUE KEY unique_attendance_shift (worker_id, date, shift)");
        console.log('✅ Added unique_attendance_shift (worker_id, date, shift)');

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    }

    console.log('Done!');
    process.exit();
}

run();
