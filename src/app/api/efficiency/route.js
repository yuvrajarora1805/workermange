import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// GET - calculate and return efficiency scores for all active workers
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        // Get all active workers
        const [workers] = await pool.query('SELECT * FROM workers WHERE is_active = 1 ORDER BY name');

        const scores = [];

        for (const worker of workers) {
            let productionScore = 0;
            let logCount = 0;
            let maxProdScore = 0;
            let bestProduct = '—';
            let bestMachine = '—';

            // Priority 1: Check for manual efficiency overrides
            const [manualEff] = await pool.query(`
                SELECT me.efficiency_pct, COALESCE(p.name, '—') as product_name, COALESCE(m.name, '—') as machine_name
                FROM manual_efficiency me
                LEFT JOIN products p ON p.id = me.product_id
                LEFT JOIN machines m ON m.id = me.machine_id
                WHERE me.worker_id = ?
                ORDER BY me.efficiency_pct DESC
                LIMIT 1
            `, [worker.id]);

            if (manualEff.length > 0) {
                const [manualAvg] = await pool.query('SELECT AVG(efficiency_pct) as avg_pct, COUNT(*) as cnt FROM manual_efficiency WHERE worker_id = ?', [worker.id]);
                logCount = manualAvg[0].cnt;
                
                // For manual, the "max" is the top record found by the DESC query
                maxProdScore = parseFloat(((manualEff[0].efficiency_pct / 100) * 80).toFixed(2));
                bestProduct = manualEff[0].product_name;
                bestMachine = manualEff[0].machine_name;
                
                // Score for leaderboard is the MAX as requested
                productionScore = maxProdScore;
            } else {
                // Priority 2: Calculate from historical production logs (80%)
                const [prodLogs] = await pool.query(`
                    SELECT 
                        MAX(CASE WHEN target_units > 0 THEN LEAST((actual_units / target_units) * 80, 80) ELSE 0 END) as max_production_score,
                        COUNT(*) as log_count
                    FROM production_logs
                    WHERE worker_id = ?
                    AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                `, [worker.id]);

                logCount = prodLogs[0].log_count;
                maxProdScore = prodLogs[0].max_production_score ? parseFloat(parseFloat(prodLogs[0].max_production_score).toFixed(2)) : 0;
                productionScore = maxProdScore;
                
                // Get best machine/product specialty (highest score on a REAL machine in last 30 days)
                const [bestRow] = await pool.query(`
                    SELECT p.name as product_name, m.name as machine_name
                    FROM production_logs pl
                    JOIN products p ON p.id = pl.product_id
                    JOIN machines m ON m.id = pl.machine_id
                    WHERE pl.worker_id = ? AND target_units > 0
                    AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                    ORDER BY LEAST((actual_units / target_units) * 80, 80) DESC, pl.date DESC
                    LIMIT 1
                `, [worker.id]);
                
                if (bestRow.length > 0) {
                    bestProduct = bestRow[0].product_name;
                    bestMachine = bestRow[0].machine_name;
                } else {
                    // Fallback: If no machine-linked records in 30 days, look at ALL historical machine-linked records
                    const [historicalBest] = await pool.query(`
                        SELECT p.name as product_name, m.name as machine_name
                        FROM production_logs pl
                        JOIN products p ON p.id = pl.product_id
                        JOIN machines m ON m.id = pl.machine_id
                        WHERE pl.worker_id = ? AND target_units > 0
                        ORDER BY LEAST((actual_units / target_units) * 80, 80) DESC, pl.date DESC
                        LIMIT 1
                    `, [worker.id]);

                    if (historicalBest.length > 0) {
                        bestProduct = historicalBest[0].product_name;
                        bestMachine = historicalBest[0].machine_name;
                    } else if (maxProdScore > 0) {
                        // Very last fallback: Get product even if machine is still null
                        const [prodOnly] = await pool.query(`
                            SELECT COALESCE(p.name, '—') as product_name
                            FROM production_logs pl
                            LEFT JOIN products p ON p.id = pl.product_id
                            WHERE pl.worker_id = ? AND target_units > 0
                            ORDER BY LEAST((actual_units / target_units) * 80, 80) DESC, pl.date DESC
                            LIMIT 1
                        `, [worker.id]);
                        if (prodOnly.length > 0) bestProduct = prodOnly[0].product_name;
                    }
                }
            }

            // Calculate rating score (20%)
            const [ratings] = await pool.query(`
                SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count
                FROM manager_ratings
                WHERE worker_id = ?
                AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            `, [worker.id]);

            const avgRating = ratings[0].avg_rating ? parseFloat(ratings[0].avg_rating) : 0;
            const ratingScore = avgRating > 0 ? parseFloat(((avgRating / 4) * 20).toFixed(2)) : 0;
            const totalScore = parseFloat((productionScore + ratingScore).toFixed(2));

            console.log(`Worker ${worker.employee_id} (${worker.name}): MaxScore=${productionScore}, Rating=${ratingScore}, Total=${totalScore}`);

            // Upsert into efficiency_scores table
            const scoreDate = date || new Date().toISOString().split('T')[0];
            await pool.query(`
                INSERT INTO efficiency_scores (worker_id, date, production_score, rating_score, total_score)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    production_score = VALUES(production_score),
                    rating_score = VALUES(rating_score),
                    total_score = VALUES(total_score)
            `, [worker.id, scoreDate, productionScore, ratingScore, totalScore]);

            scores.push({
                worker_id: worker.id,
                worker_name: worker.name,
                employee_id: worker.employee_id,
                skill_level: worker.skill_level,
                production_score: productionScore,
                best_product: bestProduct,
                best_machine: bestMachine,
                rating_score: ratingScore,
                total_score: totalScore,
                production_logs_count: logCount,
                ratings_count: ratings[0].rating_count,
            });
        }

        // Sort by total score descending
        scores.sort((a, b) => b.total_score - a.total_score);

        return NextResponse.json({ success: true, data: scores });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
