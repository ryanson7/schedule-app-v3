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

function safeParseInteger(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  const stringValue = value.toString().trim();
  if (stringValue === '' || stringValue === 'null' || stringValue === 'undefined') {
    return null;
  }
  
  const parsed = parseInt(stringValue, 10);
  if (isNaN(parsed)) {
    return null;
  }
  
  return parsed;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, ...updateData } = req.body;

    if (!id) {
      return res.status(400).json({ error: '관리자 ID가 필요합니다' });
    }

    // 🎯 데이터 정제
    const processedUpdateData: any = {
      updated_at: new Date().toISOString()
    };

    // 안전하게 데이터 처리
    if (updateData.name) {
      processedUpdateData.name = updateData.name.toString().trim();
    }
    if (updateData.email) {
      processedUpdateData.email = updateData.email.toString().trim();
    }
    if (updateData.phone) {
      processedUpdateData.phone = updateData.phone.toString().trim();
    }
    if (updateData.role) {
      processedUpdateData.role = updateData.role.toString().trim();
    }
    if (updateData.status) {
      processedUpdateData.status = updateData.status.toString().trim();
    }
    if (updateData.is_active !== undefined) {
      processedUpdateData.is_active = Boolean(updateData.is_active);
    }

    // 정수 필드 처리
    if (updateData.organization_id !== undefined) {
      processedUpdateData.organization_id = safeParseInteger(updateData.organization_id);
    }
    if (updateData.position_id !== undefined) {
      processedUpdateData.position_id = safeParseInteger(updateData.position_id);
    }

    console.log('🔍 관리자 업데이트 데이터:', processedUpdateData);

    // 데이터베이스 업데이트
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(processedUpdateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('🚨 관리자 수정 에러:', error);
      return res.status(400).json({ error: error.message });
    }

    // Auth에서도 메타데이터 업데이트
    if (processedUpdateData.name || processedUpdateData.role) {
      try {
        const { data: userInfo } = await supabaseAdmin
          .from('users')
          .select('auth_user_id, email')
          .eq('id', id)
          .single();

        if (userInfo?.auth_user_id) {
          await supabaseAdmin.auth.admin.updateUserById(userInfo.auth_user_id, {
            user_metadata: {
              name: processedUpdateData.name,
              role: processedUpdateData.role
            }
          });
        }
      } catch (authError) {
        console.error('⚠️ Auth 업데이트 예외:', authError);
      }
    }

    return res.status(200).json({ 
      success: true,
      data: data?.[0] || null,
      message: '관리자 정보가 성공적으로 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('🚨 API 에러:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
}
