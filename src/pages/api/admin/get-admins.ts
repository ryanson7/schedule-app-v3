export const config = { runtime: 'edge' };

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { role, isActive, page = '1', limit = '50', search } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    let query = supabaseAdmin
      .from('users_formatted')
      .select(`
        id,
        name,
        email,
        phone,
        role,
        status,
        organization_id,
        position_id,
        temp_password,
        is_temp_password,
        is_active,
        created_at,
        updated_at,
        organizations:organization_id(id, name),
        positions:position_id(id, name)
      `);

    // 관리자 역할만 조회
    query = query.in('role', ['system_admin', 'schedule_admin', 'admin']);

    // 역할 필터
    if (role && role !== 'all') {
      query = query.eq('role', role);
    }

    // 활성화 상태 필터
    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    // 검색 필터
    if (search && search.toString().trim()) {
      const searchTerm = search.toString().trim();
      query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range((pageNum - 1) * limitNum, pageNum * limitNum - 1);

    if (error) {
      console.error('🚨 관리자 조회 에러:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ 
      success: true,
      data, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0
      }
    });

  } catch (error) {
    console.error('🚨 API 에러:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
}
