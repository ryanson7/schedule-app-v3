// pages/api/professors/get-professors.ts (개선된 버전)
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 환경변수 검증
if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.');
}

if (!supabaseServiceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
}

const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS 헤더 추가
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 환경변수 검증
  if (!supabaseAdmin) {
    console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
    return res.status(500).json({ 
      error: '서버 설정 오류',
      details: 'Supabase 환경변수가 설정되지 않았습니다.'
    });
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
      return res.status(400).json({ 
        error: '교수 데이터 조회 중 오류가 발생했습니다.',
        details: error.message 
      });
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
      data: formattedData,
      count: formattedData.length
    });

  } catch (error) {
    console.error('❌ 교수 조회 API 오류:', error);
    return res.status(500).json({
      error: '서버 내부 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
}
