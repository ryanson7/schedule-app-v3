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
    console.log('🔍 교수 목록 조회 시작');

    const { data, error } = await supabaseAdmin
      .from('professors')
      .select(`
        *,
        users!inner(id, name, email, phone, role, status, is_active, created_at, updated_at),
        professor_categories:professor_category_id(id, category_name),
        secondary_categories:secondary_category_id(id, category_name)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ 교수 조회 오류:', error);
      return res.status(400).json({ error: error.message });
    }

    const formattedData = data?.map(prof => ({
      id: prof.users.id,
      name: prof.users.name,
      email: prof.users.email,
      phone: prof.users.phone,
      phone_display: prof.users.phone,
      phone_raw: prof.users.phone?.replace(/[^0-9]/g, '') || '',
      role: prof.users.role,
      status: prof.users.status,
      is_active: prof.users.is_active,
      created_at: prof.users.created_at,
      updated_at: prof.users.updated_at,
      professor_category_id: prof.professor_category_id,
      secondary_category_id: prof.secondary_category_id,
      professor_categories: prof.professor_categories,
      secondary_categories: prof.secondary_categories
    })).sort((a, b) => a.name.localeCompare(b.name)) || [];

    console.log('✅ 교수 조회 성공:', formattedData.length, '명');

    return res.status(200).json({
      success: true,
      data: formattedData
    });

  } catch (error) {
    console.error('❌ 교수 조회 API 오류:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : '서버 오류'
    });
  }
}
