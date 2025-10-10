import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, email, name, phone, manager_type, main_location_id, position_id } = req.body;

    // 1) users 테이블 업데이트
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        name,
        phone: phone || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (userError) {
      return res.status(500).json({ error: 'Users 테이블 업데이트 실패', details: userError.message });
    }

    // 2) managers 테이블 업데이트
    const managerData = {
      manager_type,
      updated_at: new Date().toISOString()
    };

    if (manager_type === 'academy_manager' && main_location_id) {
      managerData.main_location_id = parseInt(main_location_id);
    } else if (manager_type === 'online_manager') {
      managerData.main_location_id = null;
    }

    if (position_id && position_id !== '' && position_id !== 'null') {
      managerData.position_id = parseInt(position_id);
    } else {
      managerData.position_id = null;
    }

    const { error: managerError } = await supabaseAdmin
      .from('managers')
      .update(managerData)
      .eq('user_id', id);

    if (managerError) {
      return res.status(500).json({ error: '매니저 정보 업데이트 실패', details: managerError.message });
    }

    res.status(200).json({ success: true, message: '매니저 정보가 수정되었습니다.' });

  } catch (error) {
    res.status(500).json({ error: '서버 오류', details: error.message });
  }
}
