import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Service Role Key를 사용한 Supabase 클라이언트
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ← Service Role Key 필수
);

interface ImpersonateRequest {
  email: string;
}

interface ImpersonateResponse {
  success: boolean;
  magicLink?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ImpersonateResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const { email } = req.body as ImpersonateRequest;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Magic Link 생성 (Service Role Key 권한으로)
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/admin`
      }
    });

    if (error) {
      console.error('Magic Link 생성 오류:', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      magicLink: data.properties?.action_link
    });

  } catch (error) {
    console.error('API 오류:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
