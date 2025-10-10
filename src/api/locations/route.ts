import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query(`
      SELECT 
        id,
        name,
        type,
        address
      FROM main_locations
      WHERE is_active = true
      ORDER BY 
        CASE type 
          WHEN 'studio' THEN 1 
          WHEN 'academy' THEN 2 
          ELSE 3 
        END,
        name
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('장소 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '장소 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
