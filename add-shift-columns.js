const mysql = require('mysql2/promise');

async function run() {
    const pool = mysql.createPool({ host:'localhost', user:'root', password:'', database:'workermanage' });

    // Check existing FK names so we can drop them properly
    const [fkRows] = await pool.query(`
        SELECT CONSTRAINT_NAME, TABLE_NAME 
        FROM information_schema.TABLE_CONSTRAINTS 
        WHERE CONSTRAINT_SCHEMA='workermanage' 
          AND CONSTRAINT_TYPE='FOREIGN KEY'
          AND TABLE_NAME IN ('daily_assignments','production_logs')
    `);
    console.log('Existing FKs:', JSON.stringify(fkRows));

    const steps = [];

    // Drop FKs on daily_assignments, drop old unique keys, recreate FKs
    for (const fk of fkRows.filter(r => r.TABLE_NAME === 'daily_assignments')) {
        steps.push([`ALTER TABLE daily_assignments DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`, `Dropped FK ${fk.CONSTRAINT_NAME}`]);
    }
    steps.push([`ALTER TABLE daily_assignments DROP INDEX unique_assignment_worker`, 'Dropped unique_assignment_worker']);
    steps.push([`ALTER TABLE daily_assignments DROP INDEX unique_assignment_machine`, 'Dropped unique_assignment_machine']);
    steps.push([`ALTER TABLE daily_assignments ADD UNIQUE KEY unique_assignment_worker_shift (worker_id, date, shift)`, 'Added unique_assignment_worker_shift']);
    steps.push([`ALTER TABLE daily_assignments ADD UNIQUE KEY unique_assignment_machine_shift (machine_id, date, shift)`, 'Added unique_assignment_machine_shift']);
    // Recreate FKs
    steps.push([`ALTER TABLE daily_assignments ADD CONSTRAINT fk_da_worker FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE`, 'Restored FK worker']);
    steps.push([`ALTER TABLE daily_assignments ADD CONSTRAINT fk_da_machine FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE`, 'Restored FK machine']);
    steps.push([`ALTER TABLE daily_assignments ADD CONSTRAINT fk_da_line FOREIGN KEY (line_id) REFERENCES \`lines\`(id) ON DELETE CASCADE`, 'Restored FK line']);

    // Same for production_logs
    for (const fk of fkRows.filter(r => r.TABLE_NAME === 'production_logs')) {
        steps.push([`ALTER TABLE production_logs DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`, `Dropped FK ${fk.CONSTRAINT_NAME}`]);
    }
    steps.push([`ALTER TABLE production_logs DROP INDEX unique_log`, 'Dropped unique_log']);
    steps.push([`ALTER TABLE production_logs ADD UNIQUE KEY unique_log_shift (worker_id, machine_id, date, shift)`, 'Added unique_log_shift']);
    steps.push([`ALTER TABLE production_logs ADD CONSTRAINT fk_pl_worker FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE`, 'Restored FK pl_worker']);
    steps.push([`ALTER TABLE production_logs ADD CONSTRAINT fk_pl_machine FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL`, 'Restored FK pl_machine']);

    for (const [sql, msg] of steps) {
        try {
            await pool.query(sql);
            console.log('✅', msg);
        } catch (err) {
            const skip = ['ER_DUP_FIELDNAME','ER_DUP_KEYNAME','ER_CANT_DROP_FIELD_OR_KEY','ER_ERROR_ON_RENAME'];
            if (skip.includes(err.code)) {
                console.log('⚠️  Skip (already done):', msg);
            } else {
                console.error('❌', msg, '\n   ', err.message);
            }
        }
    }

    console.log('\nDone!');
    process.exit();
}

run();
