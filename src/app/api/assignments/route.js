import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerScope } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET - retrieve today's assignments
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        let date = searchParams.get('date');
        if (!date) {
            const n = new Date();
            if (n.getHours() < 7 || (n.getHours() === 7 && n.getMinutes() < 30)) {
                n.setDate(n.getDate() - 1);
            }
            date = n.toISOString().split('T')[0];
        }
        let shift = searchParams.get('shift');

        if (!shift) {
            const hour = new Date().getHours();
            shift = ((hour > 7 || (hour === 7 && new Date().getMinutes() >= 30)) && (hour < 19 || (hour === 19 && new Date().getMinutes() < 30))) ? 'day' : 'night';
        }

        const cookieHeader = request.headers.get('cookie') || '';
        const scope = getServerScope(cookieHeader);
        console.log('--- API ASSIGNMENTS GET ---');
        console.log('Cookie Header:', cookieHeader);
        console.log('Resolved Scope:', scope);

        // Get assignments with worker and machine details
        let assignmentsQuery = `
            SELECT da.*, da.target_override,
                   w.name as worker_name, w.employee_id, w.skill_level,
                   m.name as machine_name, m.position as machine_position, m.worker_capacity,
                   l.name as line_name, l.id as line_id,
                   p.name as product_name, p.hourly_target,
                   es.total_score as efficiency_score,
                   es.production_score, es.rating_score
            FROM daily_assignments da
            JOIN workers w ON w.id = da.worker_id
            JOIN machines m ON m.id = da.machine_id
            JOIN \`lines\` l ON l.id = da.line_id
            LEFT JOIN products p ON p.id = da.product_id
            LEFT JOIN efficiency_scores es ON es.worker_id = da.worker_id 
                AND es.date = (SELECT MAX(date) FROM efficiency_scores WHERE worker_id = da.worker_id)
            WHERE da.date = ? AND da.shift = ?
        `;
        const params = [date, shift];
        if (scope.lineId) {
            assignmentsQuery += ' AND m.line_id = ?';
            params.push(scope.lineId);
        }
        assignmentsQuery += ' ORDER BY l.name, m.position ASC';

        const [assignments] = await pool.query(assignmentsQuery, params);

        // Group by line and then by machine
        const lineMap = {};
        for (const a of assignments) {
            if (!lineMap[a.line_id]) {
                lineMap[a.line_id] = {
                    line_id: a.line_id,
                    line_name: a.line_name,
                    machines: {} // Map of machine_id -> workers
                };
            }
            
            if (!lineMap[a.line_id].machines[a.machine_id]) {
                lineMap[a.line_id].machines[a.machine_id] = {
                    id: a.machine_id,
                    machine_name: a.machine_name,
                    position: a.machine_position,
                    product_name: a.product_name,
                    product_id: a.product_id,
                    hourly_target: a.hourly_target,
                    target_override: a.target_override,
                    worker_capacity: a.worker_capacity || 1, 
                    workers: []
                };
            }
            
            lineMap[a.line_id].machines[a.machine_id].workers.push({
                assignment_id: a.id,
                worker_id: a.worker_id,
                worker_name: a.worker_name,
                employee_id: a.employee_id,
                efficiency_score: a.efficiency_score,
                assigned_at: a.assigned_at,
                hourly_target: a.hourly_target
            });
        }

        const formattedLines = Object.values(lineMap).map(line => ({
            ...line,
            machines: Object.values(line.machines).sort((a, b) => a.position - b.position)
        }));

        let benchQuery = `
            SELECT w.*, es.total_score as efficiency_score
            FROM workers w
            JOIN attendance a ON a.worker_id = w.id AND a.date = ? AND a.shift = ? AND a.status IN ('present', 'late')
            LEFT JOIN daily_assignments da ON da.worker_id = w.id AND da.date = ? AND da.shift = ?
        `;
        const benchParams = [date, shift || 'day', date, shift || 'day'];
        benchQuery += `
            LEFT JOIN efficiency_scores es ON es.worker_id = w.id 
                AND es.date = (SELECT MAX(date) FROM efficiency_scores WHERE worker_id = w.id)
            WHERE da.id IS NULL AND w.is_active = 1
        `;

        const [bench] = await pool.query(benchQuery, benchParams);

        let unassignedMachinesQuery = `
            SELECT m.*, l.name as line_name, p.name as product_name, 0 as current_occupancy
            FROM machines m
            JOIN \`lines\` l ON l.id = m.line_id
            LEFT JOIN products p ON p.id = m.current_product_id
            WHERE m.is_active = 1 AND l.is_active = 1
            AND m.id NOT IN (
                SELECT machine_id FROM daily_assignments WHERE date = ? AND shift = ?
            )
        `;
        const machineParams = [date, shift || 'day'];
        if (scope.lineId) {
            unassignedMachinesQuery += ' AND m.line_id = ?';
            machineParams.push(scope.lineId);
        }
        unassignedMachinesQuery += ' ORDER BY l.name, m.position';

        const [unassignedMachines] = await pool.query(unassignedMachinesQuery, machineParams);

        return NextResponse.json({
            success: true,
            data: {
                assignments: formattedLines,
                bench: bench,
                unassigned_machines: unassignedMachines.map(m => ({ ...m, machine_name: m.name })),
                summary: {
                    total_assigned: assignments.length,
                    total_bench: bench.length,
                    total_unassigned_machines: unassignedMachines.length
                }
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST - run auto-assignment algorithm
export async function POST(request) {
    try {
        const body = await request.json();
        let date = body.date;
        if (!date) {
            const n = new Date();
            if (n.getHours() < 7 || (n.getHours() === 7 && n.getMinutes() < 30)) {
                n.setDate(n.getDate() - 1);
            }
            date = n.toISOString().split('T')[0];
        }
        const useBestEfficiency = body.useBestEfficiency || false;

        // Use shift from request if provided, otherwise auto-detect
        let shift = body.shift;
        if (!shift) {
            const hour = new Date().getHours();
            shift = ((hour > 7 || (hour === 7 && new Date().getMinutes() >= 30)) && (hour < 19 || (hour === 19 && new Date().getMinutes() < 30))) ? 'day' : 'night';
        }

        const cookieHeader = request.headers.get('cookie') || '';
        const scope = getServerScope(cookieHeader);

        // Check if explicit full reset requested (default false: preserve existing 7:00 AM allocated workers)
        const resetAll = body.resetAll || false;

        // Step 1: Clear existing AUTO assignments ONLY IF explicit full reset requested
        if (resetAll) {
            if (scope.lineId) {
                await pool.query('DELETE FROM daily_assignments WHERE date = ? AND shift = ? AND is_manual = 0 AND line_id = ?', [date, shift, scope.lineId]);
            } else {
                await pool.query('DELETE FROM daily_assignments WHERE date = ? AND shift = ? AND is_manual = 0', [date, shift]);
            }
        }

        // Step 2: Get all present/late workers who are NOT ALREADY ASSIGNED to a machine
        const [presentWorkers] = await pool.query(`
            SELECT w.id, w.name, w.employee_id, w.skill_level
            FROM workers w
            JOIN attendance a ON a.worker_id = w.id AND a.date = ? AND a.shift = ? AND a.status IN ('present', 'late')
            WHERE w.is_active = 1
            AND w.id NOT IN (SELECT worker_id FROM daily_assignments WHERE date = ? AND shift = ?)
        `, [date, shift, date, shift]);

        if (presentWorkers.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    message: `All present workers for ${shift} shift on ${date} are already allocated to machines.`,
                    assigned: 0,
                    bench: 0
                }
            });
        }

        // Step 3: Get all active machines that still have open capacity for additional workers
        let machinesQuery = `
            SELECT m.id, m.name, m.line_id, m.position, m.current_product_id, m.worker_capacity,
                   l.name as line_name, p.name as product_name,
                   (SELECT COUNT(*) FROM daily_assignments da WHERE da.machine_id = m.id AND da.date = ? AND da.shift = ?) as assigned_count
            FROM machines m
            JOIN \`lines\` l ON l.id = m.line_id
            LEFT JOIN products p ON p.id = m.current_product_id
            WHERE m.is_active = 1 AND l.is_active = 1
            AND m.id IN (
                SELECT id FROM machines WHERE worker_capacity > (
                    SELECT COUNT(*) FROM daily_assignments da WHERE da.machine_id = machines.id AND da.date = ? AND da.shift = ?
                )
            )
        `;
        const machineQueryParams = [date, shift, date, shift];
        if (scope.lineId) {
            machinesQuery += ' AND m.line_id = ?';
            machineQueryParams.push(scope.lineId);
        }
        machinesQuery += ' ORDER BY l.id ASC, m.position ASC';

        const [machines] = await pool.query(machinesQuery, machineQueryParams);

        const workerGlobalScores = {};
        for (const worker of presentWorkers) {
            const [globalProd] = await pool.query(`
                SELECT MAX(
                    CASE 
                        WHEN target_units > 0 THEN LEAST((actual_units / target_units) * 80, 80)
                        ELSE 0
                    END
                ) as max_score
                FROM production_logs
                WHERE worker_id = ?
                AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            `, [worker.id]);

            const productionScore = globalProd[0].max_score ? parseFloat(globalProd[0].max_score) : 0;

            const [ratings] = await pool.query(`
                SELECT AVG(rating) as avg_rating
                FROM manager_ratings
                WHERE worker_id = ?
                AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            `, [worker.id]);

            const avgRating = ratings[0].avg_rating ? parseFloat(ratings[0].avg_rating) : 0;
            const ratingScore = avgRating > 0 ? (avgRating / 4) * 20 : 0;

            workerGlobalScores[worker.id] = {
                production: productionScore,
                rating: ratingScore,
                total: productionScore + ratingScore
            };

            await pool.query(`
                INSERT INTO efficiency_scores (worker_id, date, production_score, rating_score, total_score)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    production_score = VALUES(production_score),
                    rating_score = VALUES(rating_score),
                    total_score = VALUES(total_score)
            `, [worker.id, date, productionScore.toFixed(2), ratingScore.toFixed(2), (productionScore + ratingScore).toFixed(2)]);
        }

        const candidates = [];
        for (const worker of presentWorkers) {
            const [machineHistory] = await pool.query(`
                SELECT machine_id, product_id,
                       MAX(LEAST((actual_units / target_units) * 80, 80)) as max_machine_score
                FROM production_logs
                WHERE worker_id = ? AND target_units > 0
                  AND date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
                GROUP BY machine_id, product_id
            `, [worker.id]);

            const historyMap = {};
            machineHistory.forEach(h => {
                const key = `${h.machine_id}-${h.product_id || 'null'}`;
                historyMap[key] = parseFloat(h.max_machine_score);
            });

            const ratingPart = workerGlobalScores[worker.id]?.rating || 0;

            for (const machine of machines) {
                let productionPart = 0;
                const exactKey = `${machine.id}-${machine.current_product_id || 'null'}`;
                
                if (useBestEfficiency) {
                    let bestHistoryScore = 0;
                    for (const key in historyMap) {
                        if (key.startsWith(`${machine.id}-`)) {
                            bestHistoryScore = Math.max(bestHistoryScore, historyMap[key]);
                        }
                    }
                    productionPart = bestHistoryScore;
                } else {
                    productionPart = historyMap[exactKey] || 0;
                }

                if (productionPart > 0) {
                    candidates.push({
                        worker,
                        machine,
                        matchScore: productionPart + ratingPart
                    });
                }
            }
        }

        candidates.sort((a, b) => b.matchScore - a.matchScore);

        const assignedWorkerIds = new Set();
        const machineOccupancy = {}; 
        machines.forEach(m => machineOccupancy[m.id] = m.assigned_count || 0);
        const assignments = [];

        for (const candidate of candidates) {
            const currentCount = machineOccupancy[candidate.machine.id] || 0;
            const capacity = candidate.machine.worker_capacity || 1;

            if (assignedWorkerIds.has(candidate.worker.id) || currentCount >= capacity) {
                continue;
            }

            // Validate product_id to avoid FK constraint errors on deleted products
            let safeProductId = null;
            if (candidate.machine.current_product_id) {
                const [productCheck] = await pool.query('SELECT id FROM products WHERE id = ?', [candidate.machine.current_product_id]);
                safeProductId = productCheck.length > 0 ? candidate.machine.current_product_id : null;
            }

            await pool.query(
                'INSERT INTO daily_assignments (worker_id, machine_id, line_id, product_id, date, shift) VALUES (?, ?, ?, ?, ?, ?)',
                [candidate.worker.id, candidate.machine.id, candidate.machine.line_id, safeProductId, date, shift]
            );

            // Open new shift log for auto-assignment ONLY IF assigning for today
            const todayStr = new Date().toISOString().split('T')[0];
            if (date === todayStr) {
                // Close any existing active shift log for this worker first
                const [activeShift] = await pool.query(
                    'SELECT id, start_time FROM worker_shift_logs WHERE worker_id = ? AND end_time IS NULL LIMIT 1',
                    [candidate.worker.id]
                );
                if (activeShift.length > 0) {
                    const hrs = Math.max(0.1, (new Date() - new Date(activeShift[0].start_time)) / 3600000);
                    await pool.query(
                        'UPDATE worker_shift_logs SET end_time = NOW(), total_hours = ? WHERE id = ?',
                        [hrs.toFixed(2), activeShift[0].id]
                    );
                }

                await pool.query(
                    'INSERT INTO worker_shift_logs (worker_id, machine_id, product_id, start_time) VALUES (?, ?, ?, NOW())',
                    [candidate.worker.id, candidate.machine.id, safeProductId]
                );
            }

            assignedWorkerIds.add(candidate.worker.id);
            machineOccupancy[candidate.machine.id] = (machineOccupancy[candidate.machine.id] || 0) + 1;

            assignments.push({
                worker_name: candidate.worker.name,
                employee_id: candidate.worker.employee_id,
                machine_name: candidate.machine.name
            });
        }

        const benchWorkers = presentWorkers.filter(w => !assignedWorkerIds.has(w.id));

        return NextResponse.json({
            success: true,
            data: {
                message: `Successfully assigned ${assignments.length} workers for ${shift} shift on ${date}.`,
                assigned: assignments.length,
                bench: benchWorkers.length,
                assignments: assignments
            }
        });
    } catch (error) {
        console.error('Assignment Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
