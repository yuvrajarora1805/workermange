import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// GET ratings
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const worker_id = searchParams.get('worker_id');
        const date = searchParams.get('date');

        let query = `
            SELECT mr.*, w.name as worker_name, w.employee_id 
            FROM manager_ratings mr
            JOIN workers w ON w.id = mr.worker_id
        `;
        const conditions = [];
        const params = [];

        if (worker_id) { conditions.push('mr.worker_id = ?'); params.push(parseInt(worker_id)); }
        if (date) { conditions.push('mr.date = ?'); params.push(date); }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY mr.date DESC, mr.id DESC';

        const [rows] = await pool.query(query, params);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST - submit rating
export async function POST(request) {
    try {
        const body = await request.json();
        const { worker_id, rating, comments, rated_by, date } = body;

        if (!worker_id || !rating) {
            return NextResponse.json({ success: false, error: 'Worker ID and rating are required' }, { status: 400 });
        }

        if (rating < 1 || rating > 4) {
            return NextResponse.json({ success: false, error: 'Rating must be between 1 and 4' }, { status: 400 });
        }

        const ratingDate = date || new Date().toISOString().split('T')[0];

        // START SYNC LOGIC
        const skillMap = {
            1: 'beginner',
            2: 'intermediate',
            3: 'advanced',
            4: 'expert'
        };
        const newSkill = skillMap[rating];

        // Use a transaction or sequential updates to sync both tables
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Insert the rating history
            const [ratingResult] = await connection.query(
                'INSERT INTO manager_ratings (worker_id, rating, comments, rated_by, date) VALUES (?, ?, ?, ?, ?)',
                [worker_id, rating, comments || null, rated_by || 'Manager', ratingDate]
            );

            // 2. Synchronize the skill level in workers table
            if (newSkill) {
                await connection.query(
                    'UPDATE workers SET skill_level = ?, rating = ? WHERE id = ?',
                    [newSkill, rating, worker_id]
                );
            }

            await connection.commit();
            return NextResponse.json({ success: true, data: { id: ratingResult.insertId, skill_updated: newSkill } }, { status: 201 });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
