import { recalculateEfficiency } from '@/lib/efficiency';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
        const worker_id = searchParams.get('worker_id');

        console.log(`--- Starting Efficiency Recalculation for ${date} ${worker_id ? `(Worker: ${worker_id})` : '(All Workers)'} ---`);

        const processed = await recalculateEfficiency(date, worker_id);

        return NextResponse.json({ 
            success: true, 
            message: `Recalculated scores for ${processed} worker(s).` 
        });
    } catch (error) {
        console.error('Recalculation error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
