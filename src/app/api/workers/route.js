import pool from '@/lib/db';
import { recalculateEfficiency } from '@/lib/efficiency';
import { NextResponse } from 'next/server';

// GET all workers
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');
        const active = searchParams.get('active');
        const id = searchParams.get('id');
        const page = parseInt(searchParams.get('page')) || 1;
        const limit = parseInt(searchParams.get('limit')) || 0; // 0 means return all
        const offset = (page - 1) * limit;

        let query = 'SELECT id, name, employee_id, phone, rating, skill_level, gender, is_active, contractor_name, dob, joining_date, father_husband_name, division, section, nature_of_work, last_attendance, aadhaar_no, pf_no, esi_no, emergency_contact, state, district, qualification FROM workers';
        let countQuery = 'SELECT COUNT(*) as total FROM workers';
        const params = [];
        const conditions = [];

        if (id) {
            conditions.push('id = ?');
            params.push(parseInt(id));
        }
        if (search) {
            conditions.push('(name LIKE ? OR employee_id LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }
        if (active !== null && active !== undefined && active !== '') {
            conditions.push('is_active = ?');
            params.push(parseInt(active));
        }

        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            query += whereClause;
            countQuery += whereClause;
        }

        const [totalRes] = await pool.query(countQuery, params);
        const total = totalRes[0].total;

        query += ' ORDER BY name ASC';
        
        if (limit > 0) {
            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);
        }

        const [rows] = await pool.query(query, params);
        return NextResponse.json({ 
            success: true, 
            data: rows,
            pagination: {
                total,
                page,
                limit,
                total_pages: limit > 0 ? Math.ceil(total / limit) : 1
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST - create new worker
export async function POST(request) {
    try {
        const body = await request.json();
        const { 
            name, phone, employee_id, rating, gender, contractor_name, dob, joining_date,
            father_husband_name, division, section, nature_of_work, last_attendance,
            aadhaar_no, pf_no, esi_no, emergency_contact, state, district, qualification,
            update_skill_only
        } = body;

        if (!name || !employee_id) {
            return NextResponse.json({ success: false, error: 'Name and Employee ID are required' }, { status: 400 });
        }

        const skillMap = { 1: 'beginner', 2: 'intermediate', 3: 'advanced', 4: 'expert' };
        const skill_level = skillMap[rating] || 'beginner';

        let updateClause = `
             name = VALUES(name),
             phone = VALUES(phone),
             rating = VALUES(rating),
             skill_level = VALUES(skill_level),
             gender = VALUES(gender),
             contractor_name = VALUES(contractor_name),
             dob = VALUES(dob),
             joining_date = VALUES(joining_date),
             father_husband_name = VALUES(father_husband_name),
             division = VALUES(division),
             section = VALUES(section),
             nature_of_work = VALUES(nature_of_work),
             last_attendance = VALUES(last_attendance),
             aadhaar_no = VALUES(aadhaar_no),
             pf_no = VALUES(pf_no),
             esi_no = VALUES(esi_no),
             emergency_contact = VALUES(emergency_contact),
             state = VALUES(state),
             district = VALUES(district),
             qualification = VALUES(qualification)`;

        if (update_skill_only) {
            updateClause = `
             rating = VALUES(rating),
             skill_level = VALUES(skill_level)`;
        }

        const [result] = await pool.query(
            `INSERT INTO workers (
                name, phone, employee_id, rating, skill_level, gender, contractor_name, dob, joining_date,
                father_husband_name, division, section, nature_of_work, last_attendance,
                aadhaar_no, pf_no, esi_no, emergency_contact, state, district, qualification
            ) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE ${updateClause}`,
            [
                name, phone || null, employee_id, rating || 2, skill_level, gender || null, contractor_name || null, dob || null, joining_date || null,
                father_husband_name || null, division || null, section || null, nature_of_work || null, last_attendance || null,
                aadhaar_no || null, pf_no || null, esi_no || null, emergency_contact || null, state || null, district || null, qualification || null
            ]
        );

        // SYNC WITH MANAGER_RATINGS
        // SYNC WITH EFFICIENCY (Automatic recalculation for today)
        if (rating) {
            const [wRows] = await pool.query('SELECT id FROM workers WHERE employee_id = ?', [employee_id]);
            if (wRows.length > 0) {
                const workerId = wRows[0].id;
                await recalculateEfficiency(null, workerId);
            }
        }

        const status = result.affectedRows === 1 ? 201 : 200;
        return NextResponse.json({ 
            success: true, 
            data: { id: result.insertId || null },
            message: result.affectedRows === 1 ? 'Worker created/updated' : 'Worker information updated'
        }, { status });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PUT - update worker
export async function PUT(request) {
    try {
        const body = await request.json();
        const { 
            id, name, phone, employee_id, rating, is_active, gender, contractor_name, dob, joining_date,
            father_husband_name, division, section, nature_of_work, last_attendance,
            aadhaar_no, pf_no, esi_no, emergency_contact, state, district, qualification
        } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Worker ID is required' }, { status: 400 });
        }

        const fields = [];
        const params = [];

        if (name !== undefined) { fields.push('name = ?'); params.push(name); }
        if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
        if (employee_id !== undefined) { fields.push('employee_id = ?'); params.push(employee_id); }
        if (rating !== undefined) { 
            fields.push('rating = ?'); params.push(rating); 
            const skillMap = { 1: 'beginner', 2: 'intermediate', 3: 'advanced', 4: 'expert' };
            fields.push('skill_level = ?'); params.push(skillMap[rating] || 'beginner');
        }
        if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active); }
        if (gender !== undefined) { fields.push('gender = ?'); params.push(gender); }
        if (contractor_name !== undefined) { fields.push('contractor_name = ?'); params.push(contractor_name); }
        if (dob !== undefined) { fields.push('dob = ?'); params.push(dob); }
        if (joining_date !== undefined) { fields.push('joining_date = ?'); params.push(joining_date); }
        if (father_husband_name !== undefined) { fields.push('father_husband_name = ?'); params.push(father_husband_name); }
        if (division !== undefined) { fields.push('division = ?'); params.push(division); }
        if (section !== undefined) { fields.push('section = ?'); params.push(section); }
        if (nature_of_work !== undefined) { fields.push('nature_of_work = ?'); params.push(nature_of_work); }
        if (last_attendance !== undefined) { fields.push('last_attendance = ?'); params.push(last_attendance); }
        if (aadhaar_no !== undefined) { fields.push('aadhaar_no = ?'); params.push(aadhaar_no); }
        if (pf_no !== undefined) { fields.push('pf_no = ?'); params.push(pf_no); }
        if (esi_no !== undefined) { fields.push('esi_no = ?'); params.push(esi_no); }
        if (emergency_contact !== undefined) { fields.push('emergency_contact = ?'); params.push(emergency_contact); }
        if (state !== undefined) { fields.push('state = ?'); params.push(state); }
        if (district !== undefined) { fields.push('district = ?'); params.push(district); }
        if (qualification !== undefined) { fields.push('qualification = ?'); params.push(qualification); }

        if (fields.length === 0) {
            return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
        }

        params.push(id);
        await pool.query(`UPDATE workers SET ${fields.join(', ')} WHERE id = ?`, params);

        // SYNC WITH EFFICIENCY (Automatic recalculation for today)
        if (rating !== undefined) {
             await recalculateEfficiency(null, id);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE - remove worker
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'Worker ID is required' }, { status: 400 });
        }

        await pool.query('DELETE FROM workers WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
