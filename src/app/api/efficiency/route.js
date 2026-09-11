import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// GET - calculate and return efficiency scores for all active workers
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).toLocaleDateString("en-CA");
        const page = parseInt(searchParams.get('page')) || 1;
        const limit = parseInt(searchParams.get('limit')) || 50;
        const offset = (page - 1) * limit;

        // 1. Get GLOBAL STATS for the entire day (Not just this page)
        const [statsRes] = await pool.query(`
            SELECT 
                COUNT(*) as total_workers,
                AVG(total_score) as avg_score,
                SUM(CASE WHEN total_score >= 70 THEN 1 ELSE 0 END) as high_performers,
                SUM(CASE WHEN total_score < 30 THEN 1 ELSE 0 END) as low_performers
            FROM efficiency_scores 
            WHERE date = ?
        `, [date]);
        
        const globalStats = {
            total_workers: statsRes[0].total_workers || 0,
            avg_score: parseFloat(statsRes[0].avg_score || 0).toFixed(1),
            high_performers: parseInt(statsRes[0].high_performers || 0),
            low_performers: parseInt(statsRes[0].low_performers || 0)
        };

        // 2. Get paginated scores joined with worker details
        const [rows] = await pool.query(`
            SELECT 
                es.*, 
                w.name as worker_name, 
                w.employee_id, 
                w.rating,
                w.skill_level 
            FROM efficiency_scores es
            JOIN workers w ON w.id = es.worker_id
            WHERE es.date = ?
            ORDER BY es.total_score DESC
            LIMIT ? OFFSET ?
        `, [date, limit, offset]);

        // 3. For the small page set, fetch best machine/product if missing from cache
        for (const row of rows) {
            const [bestRow] = await pool.query(`
                SELECT p.name as product_name, m.name as machine_name, m.line_name
                FROM production_logs pl
                JOIN products p ON p.id = pl.product_id
                JOIN machines m ON m.id = pl.machine_id
                WHERE pl.worker_id = ? AND target_units > 0
                AND date >= DATE_SUB(?, INTERVAL 30 DAY)
                ORDER BY GREATEST(0, LEAST((actual_units / target_units) * 80, 80) - CASE WHEN machine_fault_flag = 0 THEN defective_count ELSE 0 END) DESC
                LIMIT 1
            `, [row.worker_id, date]);

            if (bestRow.length > 0) {
                row.best_product = bestRow[0].product_name;
                row.best_machine = bestRow[0].machine_name;
                row.line_name = bestRow[0].line_name;
            } else {
                row.best_product = '—';
                row.best_machine = '—';
                row.line_name = '—';
            }
        }

        return NextResponse.json({ 
            success: true, 
            data: rows,
            global_stats: globalStats,
            pagination: {
                total: globalStats.total_workers,
                page,
                limit,
                total_pages: Math.ceil(globalStats.total_workers / limit) || 1
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
