const mysql = require('mysql2/promise');

async function seedAttendance() {
    const pool = await mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'workermanage',
    });

    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    const shift = (hour >= 7 && hour < 19) ? 'day' : 'night';

    console.log(`Seeding attendance for ${today} [${shift} shift]...`);

    try {
        const [workers] = await pool.query('SELECT id FROM workers WHERE is_active = 1');
        
        let count = 0;
        for (const worker of workers) {
            await pool.query(`
                INSERT INTO attendance (worker_id, date, shift, status, check_in_time)
                VALUES (?, ?, ?, 'present', '08:00:00')
                ON DUPLICATE KEY UPDATE status = 'present'
            `, [worker.id, today, shift]);
            count++;
        }

        console.log(`✅ Success! Marked ${count} workers as PRESENT for today's ${shift} shift.`);
        console.log('Now go to the Assignments page and click "Run Auto-Assignment" again.');

    } catch (err) {
        console.error('❌ Error seeding attendance:', err.message);
    }

    await pool.end();
}

seedAttendance();
