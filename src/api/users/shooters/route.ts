import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query(`
      SELECT 
        u.id,
        u.name,
        u.employment_type,
        p.position_name,
        COALESCE(o.org_name, '교수진') as organization_name,
        pc.category_name,
        u.employee_code,
        u.hire_date
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN positions p ON u.position_id = p.id
      LEFT JOIN professor_categories pc ON u.professor_category_id = pc.id
      WHERE u.status = 'active'
      AND u.shooter_type IN ('employee', 'dispatch', 'freelance', 'professor')
      ORDER BY 
        CASE 
          WHEN o.org_code = 'HQ001' THEN 1
          WHEN o.org_code = 'TEAM001' THEN 2  
          WHEN o.org_code = 'TEAM002' THEN 3
          WHEN o.org_code = 'TEAM003' THEN 4
          WHEN u.shooter_type = 'professor' THEN 5
          ELSE 6
        END,
        p.level DESC,
        u.hire_date
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('촬영자 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '촬영자 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
