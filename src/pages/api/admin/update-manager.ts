// src/pages/api/admin/update-manager.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type Data =
  | { success: true; message: string }
  | { error: string; details?: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      id,
      email,
      name,
      phone,
      manager_type,
      main_location_id,
      position_id,
    } = req.body as {
      id: number;
      email: string;
      name: string;
      phone: string;
      manager_type: 'academy_manager' | 'online_manager';
      main_location_id?: string;
      position_id?: string;
    };

    if (!id || !email || !name) {
      return res
        .status(400)
        .json({ error: '필수 값(id, email, name)이 누락되었습니다.' });
    }

    const allowedManagerTypes = ['academy_manager', 'online_manager'] as const;
    const normalizedManagerType = allowedManagerTypes.includes(
      manager_type as any
    )
      ? manager_type
      : 'online_manager';

    // 1) users 테이블 기본 정보 업데이트 (role 은 manager 로 고정)
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        name,
        phone: phone || null,
        role: 'manager',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('email', email);

    if (userError) {
      return res.status(500).json({
        error: 'Users 테이블 업데이트 실패',
        details: userError.message,
      });
    }

    // 2) managers 테이블 upsert
    const parsedMainLocationId =
      normalizedManagerType === 'academy_manager' && main_location_id
        ? Number(main_location_id)
        : null;

    const parsedPositionId =
      position_id && position_id !== '' && position_id !== 'null'
        ? Number(position_id)
        : null;

    const { error: managerError } = await supabaseAdmin
      .from('managers')
      .upsert(
        {
          user_id: id,
          manager_type: normalizedManagerType,
          main_location_id: parsedMainLocationId,
          position_id: parsedPositionId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (managerError) {
      return res.status(500).json({
        error: '매니저 정보 업데이트 실패',
        details: managerError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: '매니저 정보가 수정되었습니다.',
    });
  } catch (error: any) {
    return res.status(500).json({
      error: '서버 오류',
      details: error?.message || '알 수 없는 에러',
    });
  }
}
