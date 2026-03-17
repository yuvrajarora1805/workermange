const mysql = require('mysql2/promise');

async function run() {
    const pool = mysql.createPool({ host:'localhost', user:'root', password:'', database:'workermanage' });

    console.log('🔄 Starting migration for multiple workers...');

    try {
        // 1. Add column allow_multiple_workers to machines
        await pool.query("ALTER TABLE machines ADD COLUMN allow_multiple_workers TINYINT(1) DEFAULT 0 AFTER is_active");
        console.log('✅ Added allow_multiple_workers column to machines');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️  Column allow_multiple_workers already exists in machines');
        } else {
            console.error('❌ Error adding column:', err.message);
        }
    }

    try {
        // 2. Drop unique_assignment_machine_shift index from daily_assignments
        // We need to find the actual constraint name if it differs or drop by index name
        // Usually it's named unique_assignment_machine_shift based on add-shift-columns.js
        await pool.query("ALTER TABLE daily_assignments DROP INDEX unique_assignment_machine_shift");
        console.log('✅ Dropped unique_assignment_machine_shift index from daily_assignments');
    } catch (err) {
        if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
            console.log('⚠️  Index unique_assignment_machine_shift already dropped or doesn\'t exist');
        } else {
            console.error('❌ Error dropping index:', err.message);
        }
    }

    console.log('\nMigration Done!');
    process.exit();
}

run();
