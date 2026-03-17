import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// GET - retrieve today's assignments
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
        const shift = searchParams.get('shift');

        // Get assignments with worker and machine details
        let assignmentsQuery = `
            SELECT da.*, 
                   w.name as worker_name, w.employee_id, w.skill_level,
                   m.name as machine_name, m.position as machine_position, m.worker_capacity,
                   l.name as line_name, l.id as line_id,
                   p.name as product_name,
                   es.total_score as efficiency_score,
                   es.production_score, es.rating_score
            FROM daily_assignments da
            JOIN workers w ON w.id = da.worker_id
            JOIN machines m ON m.id = da.machine_id
            JOIN \`lines\` l ON l.id = da.line_id
            LEFT JOIN products p ON p.id = da.product_id
            LEFT JOIN efficiency_scores es ON es.worker_id = da.worker_id 
                AND es.date = (SELECT MAX(date) FROM efficiency_scores WHERE worker_id = da.worker_id)
            WHERE da.date = ?
        `;
        const params = [date];
        if (shift) {
            assignmentsQuery += ' AND da.shift = ?';
            params.push(shift);
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
                    worker_capacity: a.worker_capacity || 1, // Need to add this to query
                    workers: []
                };
            }
            
            lineMap[a.line_id].machines[a.machine_id].workers.push({
                assignment_id: a.id,
                worker_id: a.worker_id,
                worker_name: a.worker_name,
                employee_id: a.employee_id,
                efficiency_score: a.efficiency_score
            });
        }

        // Convert machines object to array and sort by position
        const formattedLines = Object.values(lineMap).map(line => ({
            ...line,
            machines: Object.values(line.machines).sort((a, b) => a.position - b.position)
        }));

        // Get unassigned (bench) workers who are present but not assigned in THIS shift
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

        // Get truly unassigned machines (0 workers)
        const [unassignedMachines] = await pool.query(`
            SELECT m.*, l.name as line_name, p.name as product_name, 0 as current_occupancy
            FROM machines m
            JOIN \`lines\` l ON l.id = m.line_id
            LEFT JOIN products p ON p.id = m.current_product_id
            WHERE m.is_active = 1 AND l.is_active = 1
            AND m.id NOT IN (
                SELECT machine_id FROM daily_assignments WHERE date = ? AND shift = ?
            )
            ORDER BY l.name, m.position
        `, [date, shift || 'day']);

        return NextResponse.json({
            success: true,
            data: {
                assignments: formattedLines,
                bench: bench,
                unassigned_machines: unassignedMachines.map(m => ({ ...m, machine_name: m.name })), // Normalize name
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
        const date = body.date || new Date().toISOString().split('T')[0];

        // Auto-detect which shift this run is for based on current time
        const hour = new Date().getHours();
        const shift = (hour >= 7 && hour < 19) ? 'day' : 'night';

        // Step 1: Clear existing AUTO assignments for this date+shift only
        await pool.query('DELETE FROM daily_assignments WHERE date = ? AND shift = ? AND is_manual = 0', [date, shift]);

        // Step 2: Get all present workers (excluding those already manually assigned today)
        const [presentWorkers] = await pool.query(`
            SELECT w.id, w.name, w.employee_id, w.skill_level
            FROM workers w
            JOIN attendance a ON a.worker_id = w.id AND a.date = ? AND a.shift = ? AND a.status IN ('present', 'late')
            WHERE w.is_active = 1
            AND w.id NOT IN (SELECT worker_id FROM daily_assignments WHERE date = ? AND shift = ? AND is_manual = 1)
        `, [date, shift, date, shift]);

        if (presentWorkers.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    message: 'No workers present for assignment',
                    assigned: 0,
                    bench: 0
                }
            });
        }

        // Step 3: Get all active machines and their assigned products (excluding those fully manually assigned today)
        const [machines] = await pool.query(`
            SELECT m.id, m.name, m.line_id, m.position, m.current_product_id, m.worker_capacity,
                   l.name as line_name, p.name as product_name,
                   (SELECT COUNT(*) FROM daily_assignments da WHERE da.machine_id = m.id AND da.date = ? AND da.shift = ? AND da.is_manual = 1) as manual_count
            FROM machines m
            JOIN \`lines\` l ON l.id = m.line_id
            LEFT JOIN products p ON p.id = m.current_product_id
            WHERE m.is_active = 1 AND l.is_active = 1
            AND m.id IN (
                SELECT id FROM machines WHERE worker_capacity > (
                    SELECT COUNT(*) FROM daily_assignments da WHERE da.machine_id = machines.id AND da.date = ? AND da.shift = ? AND da.is_manual = 1
                )
            )
            ORDER BY l.id ASC, m.position ASC
        `, [date, shift, date, shift]);

        // Step 4: Calculate Global and Machine-Specific Efficiency for each worker
        const workerGlobalScores = {};
        for (const worker of presentWorkers) {
            // Global production score (avg of all machines)
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

            // Rating score (20%)
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

            // Updated efficiency_scores table for reference
            await pool.query(`
                INSERT INTO efficiency_scores (worker_id, date, production_score, rating_score, total_score)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    production_score = VALUES(production_score),
                    rating_score = VALUES(rating_score),
                    total_score = VALUES(total_score)
            `, [worker.id, date, productionScore.toFixed(2), ratingScore.toFixed(2), (productionScore + ratingScore).toFixed(2)]);
        }

        // Step 5: Build all possible (Worker, Machine) matching candidates
        const candidates = [];
        for (const worker of presentWorkers) {
            // Get MOST RECENT machine & product specific historical efficiency for this worker
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

            // Get MANUAL efficiency overrides for this worker
            const [manualEff] = await pool.query(`
                SELECT machine_id, product_id, (efficiency_pct / 100) * 80 as manual_score
                FROM manual_efficiency
                WHERE worker_id = ?
            `, [worker.id]);

            const manualMap = {};
            manualEff.forEach(m => {
                const key = `${m.machine_id}-${m.product_id || 'null'}`;
                manualMap[key] = parseFloat(m.manual_score);
            });

            const globalScore = workerGlobalScores[worker.id];

            for (const machine of machines) {
                const ratingPart = workerGlobalScores[worker.id]?.rating || 0;
                let productionPart = 0;
                
                // exact match only: machine + product
                const exactKey = `${machine.id}-${machine.current_product_id || 'null'}`;
                const manualScore = manualMap[exactKey];
                const historyScore = historyMap[exactKey];

                if (manualScore !== undefined || historyScore !== undefined) {
                    // Use the BEST score available between Manual and Max History
                    productionPart = Math.max(manualScore || 0, historyScore || 0);
                }

                // Total matching score = Production (80%) + Rating (20%)
                const totalMatchScore = productionPart + ratingPart;

                candidates.push({
                    worker,
                    machine,
                    matchScore: totalMatchScore
                });
            }
        }

        // Step 6: Greedy Matching algorithm
        // Sort candidates by match score descending
        candidates.sort((a, b) => b.matchScore - a.matchScore);

        const assignedWorkerIds = new Set();
        const machineOccupancy = {}; // Track how many workers are assigned to each machine
        machines.forEach(m => {
            machineOccupancy[m.id] = m.manual_count || 0;
        });
        const assignments = [];

        for (const candidate of candidates) {
            const currentCount = machineOccupancy[candidate.machine.id] || 0;
            const capacity = candidate.machine.worker_capacity || 1;

            if (assignedWorkerIds.has(candidate.worker.id) || currentCount >= capacity) {
                continue;
            }

            // Perform assignment
            await pool.query(
                'INSERT INTO daily_assignments (worker_id, machine_id, line_id, product_id, date, shift) VALUES (?, ?, ?, ?, ?, ?)',
                [candidate.worker.id, candidate.machine.id, candidate.machine.line_id, candidate.machine.current_product_id, date, shift]
            );

            assignedWorkerIds.add(candidate.worker.id);
            machineOccupancy[candidate.machine.id] = (machineOccupancy[candidate.machine.id] || 0) + 1;

            assignments.push({
                worker_name: candidate.worker.name,
                employee_id: candidate.worker.employee_id,
                efficiency: candidate.matchScore.toFixed(2),
                machine_name: candidate.machine.name,
                line_name: candidate.machine.line_name,
                product_name: candidate.machine.product_name || 'N/A'
            });
        }

        // Step 7: Handle bench workers (not assigned to any machine)
        const benchWorkers = presentWorkers
            .filter(w => !assignedWorkerIds.has(w.id))
            .map(w => ({
                worker_name: w.name,
                employee_id: w.employee_id,
                efficiency: workerGlobalScores[w.id].toFixed(2)
            }));

        return NextResponse.json({
            success: true,
            data: {
                message: `Successfully assigned ${assignments.length} workers to machines based on efficiency history.`,
                assigned: assignments.length,
                bench: benchWorkers.length,
                assignments: assignments,
                bench_workers: benchWorkers
            }
        });
    } catch (error) {
        console.error('Assignment Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
