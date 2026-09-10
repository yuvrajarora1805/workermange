import pool from '@/lib/db';
import { recalculateEfficiency } from '@/lib/efficiency';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST - bulk attendance and skill update
export async function POST(request) {
    const connection = await pool.getConnection();
    let successCount = 0;
    let errorCount = 0;
    const failedEntries = [];
    
    try {
        const body = await request.json();
        const records = body.records || [body];

        await connection.beginTransaction();

        // Pre-fetch all workers
        const [allWorkers] = await connection.query('SELECT id, employee_id FROM workers');
        const workerMap = {};
        allWorkers.forEach(w => {
            if (w.employee_id) workerMap[String(w.employee_id).trim()] = w.id;
        });

        const processedWorkerIds = new Set();

        for (let i = 0; i < records.length; i++) {
            const rec = records[i];
            let { employee_id, worker_id, worker_name, date, in_time, status, skill_level, shift, row_index } = rec;
            const rowNumber = row_index || (i + 2); // Fallback to index + 2 (assuming row 1 is headers)

            if ((!employee_id && !worker_id) || !date) {
                failedEntries.push({
                    row: rowNumber,
                    employee_id: employee_id || 'N/A',
                    reason: 'Worker ID or Punch Date is missing.'
                });
                errorCount++;
                continue;
            }

            try {
                let targetWorkerId = worker_id;
                
                if (!targetWorkerId && employee_id) {
                    targetWorkerId = workerMap[String(employee_id).trim()];
                }

                if (!targetWorkerId) {
                    // Auto-insert missing worker!
                    const skillToRating = { 'beginner': 1, 'intermediate': 2, 'advanced': 3, 'expert': 4 };
                    const defaultSkill = skill_level ? skill_level.toLowerCase() : 'intermediate';
                    const defaultRating = skill_level ? (skillToRating[skill_level.toLowerCase()] || 2) : 2;
                    const finalName = worker_name || `Auto-Imported (${employee_id})`;

                    const [insertResult] = await connection.query(
                        `INSERT INTO workers (name, employee_id, rating, skill_level, is_active) 
                         VALUES (?, ?, ?, ?, 1)`,
                        [finalName, String(employee_id).trim(), defaultRating, defaultSkill]
                    );
                    
                    targetWorkerId = insertResult.insertId;
                    workerMap[String(employee_id).trim()] = targetWorkerId;
                }

                processedWorkerIds.add(targetWorkerId);

                // 3. Update worker rating if provided
                if (skill_level) {
                    const skillToRating = { 'beginner': 1, 'intermediate': 2, 'advanced': 3, 'expert': 4 };
                    const ratingToSkill = { 1: 'beginner', 2: 'intermediate', 3: 'advanced', 4: 'expert' };
                    
                    let numericRating = parseInt(skill_level);
                    let skillLabel = skill_level;

                    // If it's a label (e.g. 'advanced'), map to number
                    if (isNaN(numericRating)) {
                        numericRating = skillToRating[skill_level.toLowerCase()] || null;
                    } else {
                        // If it's a number, map to label
                        skillLabel = ratingToSkill[numericRating] || null;
                    }

                    if (numericRating && numericRating >= 1 && numericRating <= 4) {
                        await connection.query('UPDATE workers SET rating = ?, skill_level = ? WHERE id = ?', [numericRating, skillLabel, targetWorkerId]);

                        await connection.query(
                            `INSERT INTO manager_ratings (worker_id, rating, comments, rated_by, date) 
                             VALUES (?, ?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE rating = VALUES(rating)`,
                            [targetWorkerId, numericRating, 'Updated via attendance report', 'System/Sync', date]
                        );
                    }
                }

                // 4. Upsert attendance
                await connection.query(
                    `INSERT INTO attendance (worker_id, date, check_in_time, status, shift) 
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE 
                     check_in_time = VALUES(check_in_time),
                     status = VALUES(status)`,
                    [targetWorkerId, date, in_time || null, status || 'present', shift || 'day']
                );

                successCount++;
            } catch (err) {
                console.error(`Error processing record:`, err);
                failedEntries.push({
                    row: rowNumber,
                    employee_id: employee_id || 'N/A',
                    reason: err.message || 'Database error occurred during sync.'
                });
                errorCount++;
            }
        }

        await connection.commit();

        // 5. Trigger efficiency recalculation for the updated dates AND SPECIFIC WORKERS only
        const uniqueDates = [...new Set(records.map(r => r.date).filter(Boolean))];
        const workerIdsArray = [...processedWorkerIds];
        
        if (workerIdsArray.length > 0) {
            for (const d of uniqueDates) {
                await recalculateEfficiency(d, workerIdsArray);
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Processed ${records.length} records: ${successCount} successful, ${errorCount} failed.`,
            failedEntries
        });
    } catch (error) {
        if (connection) await connection.rollback();
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// GET - fetch attendance by worker_id or date
import { getServerScope } from '@/lib/auth';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const worker_id = searchParams.get('worker_id');
        const date = searchParams.get('date');
        const shift = searchParams.get('shift') || 'day';

        // case 1: fetch workers with attendance status for a specific date/shift (Page View)
        if (date && !worker_id) {
            const cookieHeader = request.headers.get('cookie') || '';
            const scope = getServerScope(cookieHeader);

            let workersQuery = 'SELECT id, name, employee_id FROM workers WHERE is_active = 1';
            let queryParams = [];

            if (scope.lineId) {
                // Show workers currently assigned to this line or not assigned to any active shifts (bench workers)
                workersQuery = `
                    SELECT DISTINCT w.id, w.name, w.employee_id 
                    FROM workers w
                    LEFT JOIN worker_shift_logs wsl ON wsl.worker_id = w.id AND wsl.end_time IS NULL
                    LEFT JOIN machines m ON m.id = wsl.machine_id
                    WHERE w.is_active = 1
                      AND (m.line_id = ? OR wsl.line_id = ? OR wsl.id IS NULL OR wsl.machine_id IS NULL)
                `;
                queryParams = [scope.lineId, scope.lineId];
            }

            // 1. Get filtered workers
            const [workers] = await pool.query(workersQuery, queryParams);
            
            // 2. Get attendance for that day/shift
            const [attendance] = await pool.query('SELECT * FROM attendance WHERE date = ? AND shift = ?', [date, shift]);
            
            // 3. Merge
            const attMap = {};
            attendance.forEach(a => attMap[a.worker_id] = a);

            const merged = workers.map(w => {
                const att = attMap[w.id];
                return {
                    ...w,
                    status: att ? att.status : null,
                    check_in_time: att ? att.check_in_time : null,
                    check_out_time: att ? att.check_out_time : null
                };
            });

            // 4. Summary
            const summary = {
                total: merged.length,
                present: merged.filter(w => w.status === 'present').length,
                late: merged.filter(w => w.status === 'late').length,
                absent: merged.filter(w => w.status === 'absent').length,
                unmarked: merged.filter(w => !w.status).length
            };

            return NextResponse.json({ success: true, data: { workers: merged, summary } });
        }

        // case 2: fetch raw attendance logs for a specific worker
        let query = 'SELECT * FROM attendance WHERE 1=1';
        const params = [];

        if (worker_id) {
            query += ' AND worker_id = ?';
            params.push(worker_id);
        }
        if (date) {
            query += ' AND date = ?';
            params.push(date);
        }

        query += ' ORDER BY date DESC';

        const [rows] = await pool.query(query, params);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE - clear attendance for a specific date/shift
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const shift = searchParams.get('shift') || 'day';

        if (!date) {
            return NextResponse.json({ success: false, error: 'Date is required' }, { status: 400 });
        }

        const [result] = await pool.query('DELETE FROM attendance WHERE date = ? AND shift = ?', [date, shift]);

        return NextResponse.json({
            success: true,
            message: `Cleared ${result.affectedRows} attendance records for ${date} (${shift})`
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
