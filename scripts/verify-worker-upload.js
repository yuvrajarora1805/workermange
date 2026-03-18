const mysql = require('mysql2/promise');

async function verify() {
    const pool = await mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'workermanage',
    });

    console.log('Verifying worker table structure and data...');

    try {
        const [columns] = await pool.query('SHOW COLUMNS FROM workers');
        console.log('Columns in workers table:');
        columns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));

        const hasGender = columns.some(col => col.Field === 'gender');
        if (hasGender) {
            console.log('✅ "gender" column exists.');
        } else {
            console.log('❌ "gender" column is missing!');
        }

        // Try to insert a test worker with gender
        const testEmployeeId = 'TEST_' + Math.floor(Math.random() * 10000);
        await pool.query(
            'INSERT INTO workers (name, employee_id, gender, skill_level) VALUES (?, ?, ?, ?)',
            ['Test Worker', testEmployeeId, 'MALE', 'beginner']
        );
        console.log(`✅ Successfully inserted test worker ${testEmployeeId} with gender MALE.`);

        // Verify retrieval
        const [rows] = await pool.query('SELECT * FROM workers WHERE employee_id = ?', [testEmployeeId]);
        if (rows.length > 0 && rows[0].gender === 'MALE') {
            console.log('✅ Successfully retrieved worker with correct gender.');
        } else {
            console.log('❌ Failed to retrieve worker or gender mismatch.');
        }

        // Cleanup
        await pool.query('DELETE FROM workers WHERE employee_id = ?', [testEmployeeId]);
        console.log('✅ Cleaned up test worker.');

    } catch (err) {
        console.error('❌ Verification error:', err.message);
    }

    await pool.end();
}

verify();
