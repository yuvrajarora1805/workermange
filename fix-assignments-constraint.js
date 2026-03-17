const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'workermanage'
    });

    try {
        console.log('Starting migration to fix daily_assignments constraints...');

        // 1. Add a non-unique index on machine_id to support the foreign key
        // This is necessary before dropping the unique index that starts with machine_id.
        try {
            await connection.query('ALTER TABLE daily_assignments ADD INDEX idx_da_machine (machine_id)');
            console.log('Successfully added non-unique index: idx_da_machine');
        } catch (err) {
            console.warn('Could not add idx_da_machine (might already exist):', err.message);
        }

        // 2. Drop the restrictive unique constraint on (machine, date, shift)
        try {
            await connection.query('ALTER TABLE daily_assignments DROP INDEX unique_assignment_machine_shift');
            console.log('Successfully dropped restrictive index: unique_assignment_machine_shift');
        } catch (err) {
            console.error('FAILED to drop unique_assignment_machine_shift:', err.message);
        }

        // 3. Clean up redundant worker indexes (we already added unique_worker_date_shift in the first attempt)
        try {
            await connection.query('ALTER TABLE daily_assignments DROP INDEX unique_assignment_worker_shift');
            console.log('Successfully dropped redundant index: unique_assignment_worker_shift');
        } catch (err) {
            console.warn('Could not drop unique_assignment_worker_shift (might not exist):', err.message);
        }

        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await connection.end();
    }
}

migrate();
function showToast(msg, type) {
    // This part is irrelevant for migration but was in the plan? No, this is node.
}
