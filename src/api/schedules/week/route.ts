import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { error: '날짜가 필요합니다.' },
        { status: 400 }
      );
    }

    const result = await query(`
      SELECT 
        s.id,
        s.main_location_id,
        s.start_time,
        s.end_time,
        s.date,
        s.subject,
        s.instructor_name,
        s.shooter_id,
        s.status,
        s.notes,
        ml.name as location_name,
        ml.type as location_type,
        u.name as shooter_name
      FROM schedules s
      JOIN main_locations ml ON s.main_location_id = ml.id
      LEFT JOIN users u ON s.shooter_id = u.id
      WHERE s.date >= $1 
      AND s.date <= $1::date + INTERVAL '6 days'
      AND s.status != 'cancelled'
      ORDER BY s.date, s.start_time
    `, [date]);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('주간 스케줄 조회 오류:', error);
    return NextResponse.json(
      { error: '스케줄을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
