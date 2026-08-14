import pool from './db';

/**
 * Recalculate efficiency score for a specific worker or all workers
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @param {number|number[]|null} workerIds - Optional single worker ID or array of IDs to update
 */
export async function recalculateEfficiency(date, workerIds = null) {
    if (!date) date = new Date().toISOString().split('T')[0];

    // 1. Get worker(s)
    let query = 'SELECT id, name, employee_id, rating, skill_level FROM workers WHERE is_active = 1';
    let params = [];
    
    if (workerIds) {
        if (Array.isArray(workerIds)) {
            if (workerIds.length === 0) return 0;
            query += ` AND id IN (${workerIds.map(() => '?').join(',')})`;
            params.push(...workerIds);
        } else {
            query += ' AND id = ?';
            params.push(workerIds);
        }
    }
    
    const [workers] = await pool.query(query, params);
    
    let processed = 0;
    for (const worker of workers) {
        let productionScore = 0;
        let maxProdScore = 0;

        // Calculate production score (80%) - Based on best performance in last 30 days
        const [prodLogs] = await pool.query(`
            SELECT 
                MAX(CASE 
                    WHEN target_units > 0 THEN 
                        GREATEST(0, LEAST((actual_units / target_units) * 80, 80) - CASE WHEN machine_fault_flag = 0 THEN defective_count ELSE 0 END)
                    ELSE 0 
                END) as max_production_score
            FROM production_logs
            WHERE worker_id = ?
            AND date >= DATE_SUB(?, INTERVAL 30 DAY)
        `, [worker.id, date]);

        maxProdScore = prodLogs[0].max_production_score ? parseFloat(parseFloat(prodLogs[0].max_production_score).toFixed(2)) : 0;
        productionScore = maxProdScore;

        // Calculate rating score (20%) - Using the new UNIFIED rating system
        const skillMap = { 'beginner': 1, 'intermediate': 2, 'advanced': 3, 'expert': 4 };
        const skillRating = skillMap[worker.skill_level] || 0;
        const numericRating = Math.max(worker.rating || 2, skillRating);
        const ratingScore = parseFloat(((numericRating / 4) * 20).toFixed(2));
        const totalScore = parseFloat((productionScore + ratingScore).toFixed(2));

        // Upsert into efficiency_scores table
        await pool.query(`
            INSERT INTO efficiency_scores (worker_id, date, production_score, rating_score, total_score)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                production_score = VALUES(production_score),
                rating_score = VALUES(rating_score),
                total_score = VALUES(total_score)
        `, [worker.id, date, productionScore, ratingScore, totalScore]);

        processed++;
    }
    return processed;
}
