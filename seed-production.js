/**
 * seed-production.js
 * Seeds realistic mock production logs so the auto-assignment algorithm has data to work with.
 * Each worker gets different efficiencies on different machine/product combos.
 * Run once: node seed-production.js
 */

const mysql = require('mysql2/promise');

async function seed() {
    const pool = await mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'workermanage',
    });

    console.log('Fetching workers, machines, and products...');
    const [[workers], [machines], [products]] = await Promise.all([
        pool.query('SELECT id, name FROM workers WHERE is_active = 1 LIMIT 20'),
        pool.query('SELECT m.id, m.line_id, m.current_product_id FROM machines m JOIN `lines` l ON l.id = m.line_id WHERE m.is_active = 1 AND l.is_active = 1 AND m.current_product_id IS NOT NULL LIMIT 30'),
        pool.query('SELECT id FROM products LIMIT 10'),
    ]);

    if (workers.length === 0) { console.error('No active workers found. Add workers first.'); process.exit(1); }
    if (machines.length === 0) { console.error('No active machines with products found. Assign products to machines first via /lines page.'); process.exit(1); }

    console.log(`Found: ${workers.length} workers, ${machines.length} machines with products`);

    // Each worker will have a "specialty" — a few machines where they are very good
    // and lower efficiency elsewhere
    let insertCount = 0;
    const today = new Date();

    for (const worker of workers) {
        // Randomly pick 2-4 machines as their "specialty" (high efficiency)
        const shuffled = [...machines].sort(() => Math.random() - 0.5);
        const specialtyCount = 2 + Math.floor(Math.random() * 3); // 2-4
        const specialtyMachines = shuffled.slice(0, specialtyCount);
        const otherMachines = shuffled.slice(specialtyCount, specialtyCount + 3); // 3 more at lower efficiency

        const allToSeed = [
            ...specialtyMachines.map(m => ({ machine: m, highSkill: true })),
            ...otherMachines.map(m => ({ machine: m, highSkill: false })),
        ];

        for (const { machine, highSkill } of allToSeed) {
            // Generate logs for last 10 days on each machine
            const logsToInsert = Math.floor(Math.random() * 4) + 2; // 2-5 logs

            for (let i = 0; i < logsToInsert; i++) {
                const daysAgo = Math.floor(Math.random() * 30) + 1;
                const logDate = new Date(today);
                logDate.setDate(today.getDate() - daysAgo);
                const dateStr = logDate.toISOString().split('T')[0];

                const targetUnits = 400;

                // High-skill: 85-98% efficiency, Low-skill: 50-75%
                const effPct = highSkill
                    ? 0.85 + Math.random() * 0.13
                    : 0.50 + Math.random() * 0.25;

                const actualUnits = Math.round(targetUnits * effPct);

                const shift = Math.random() > 0.5 ? 'day' : 'night';

                try {
                    await pool.query(
                        `INSERT IGNORE INTO production_logs (worker_id, machine_id, product_id, date, shift, target_units, actual_units)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [worker.id, machine.id, machine.current_product_id, dateStr, shift, targetUnits, actualUnits]
                    );
                    insertCount++;
                } catch (e) {
                    // Skip duplicate entries
                }
            }
        }
    }

    console.log(`\n✅ Done! Inserted ${insertCount} production log entries.`);
    console.log('\nNow you can:');
    console.log('  1. Mark workers as Present in /attendance');
    console.log('  2. Go to /assignments and click ⚡ Run Auto-Assignment');
    console.log('  3. Workers should be assigned to their BEST machine/product combo!');

    await pool.end();
    process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
