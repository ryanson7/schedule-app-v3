import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { shooter_id } = await request.json();
    const scheduleId = params.id;

    // 촬영자 배정 업데이트
    const updateResult = await query(`
      UPDATE schedules 
      SET 
        shooter_id = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [shooter_id, scheduleId]);

    if (updateResult.rows.length === 0) {
      return NextResponse.json(
        { error: '스케줄을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 업데이트된 스케줄 정보 조회 (촬영자 이름 포함)
    const scheduleResult = await query(`
      SELECT 
        s.*,
        ml.name as location_name,
        ml.type as location_type,
        u.name as shooter_name
      FROM schedules s
      JOIN main_locations ml ON s.main_location_id = ml.id
      LEFT JOIN users u ON s.shooter_id = u.id
      WHERE s.id = $1
    `, [scheduleId]);

    return NextResponse.json(scheduleResult.rows[0]);
  } catch (error) {
    console.error('촬영자 배정 오류:', error);
    return NextResponse.json(
      { error: '촬영자 배정에 실패했습니다.' },
      { status: 500 }
    );
  }
}
