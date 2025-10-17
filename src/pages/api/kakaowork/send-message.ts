export const config = {
  runtime: 'edge',
};

import { createClient } from '@supabase/supabase-js';

const KAKAOWORK_API_URL = 'https://api.kakaowork.com';

// Edge Runtime용 Supabase 클라이언트
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

// DB에서 채팅방 ID 조회
async function getConversationIdFromDB(phone: string): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('user_kakaowork_conversations')
      .select('conversation_id')
      .eq('phone', phone)
      .single();

    if (error || !data) {
      console.log('🔍 기존 채팅방 ID 없음:', phone);
      return null;
    }

    console.log('✅ 기존 채팅방 ID 발견:', data.conversation_id);
    return data.conversation_id;
  } catch (error) {
    console.log('⚠️ DB 조회 오류:', error);
    return null;
  }
}

// DB에 채팅방 ID 저장
async function saveConversationIdToDB(phone: string, userId: string, conversationId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('user_kakaowork_conversations')
      .upsert({
        phone: phone,
        kakaowork_user_id: userId,
        conversation_id: conversationId,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ 채팅방 ID 저장 실패:', error);
    } else {
      console.log('✅ 채팅방 ID 저장 성공:', conversationId);
    }
  } catch (error) {
    console.error('❌ DB 저장 오류:', error);
  }
}

export default async function handler(req: Request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, message: 'Method not allowed' }),
      { status: 405, headers }
    );
  }

  console.log('🔧 === 카카오워크 메시지 발송 시작 ===');

  try {
    const body = await req.json();
    const { userId, userName, text, blocks, scheduleId, phone } = body;

    console.log('📋 요청 데이터 확인:', {
      userId,
      userName,
      phone,
      textLength: text?.length || 0,
      blocksCount: blocks?.length || 0,
      scheduleId
    });

    if (!userId || !phone || (!text && !blocks)) {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: '필수 정보가 누락되었습니다.' 
        }),
        { status: 400, headers }
      );
    }

    const BOT_APP_KEY = process.env.KAKAOWORK_BOT_APP_KEY;
    if (!BOT_APP_KEY) {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: '카카오워크 API 키가 설정되지 않았습니다.' 
        }),
        { status: 500, headers }
      );
    }

    // 1단계: DB에서 기존 채팅방 ID 조회
    let conversationId = await getConversationIdFromDB(phone);
    const isNewConversation = !conversationId;

    // 2단계: 기존 채팅방이 없으면 새로 생성
    if (!conversationId) {
      console.log('🆕 새 채팅방 생성 시작');
      
      const conversationResponse = await fetch(`${KAKAOWORK_API_URL}/v1/conversations.open`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BOT_APP_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_ids: [userId] })
      });

      const conversationText = await conversationResponse.text();
      console.log('📡 채팅방 생성 응답:', conversationResponse.status, conversationText);

      if (!conversationResponse.ok) {
        throw new Error(`채팅방 생성 실패: ${conversationText}`);
      }

      const conversationData = JSON.parse(conversationText);
      conversationId = conversationData.conversation?.id;

      if (!conversationId) {
        throw new Error('채팅방 ID를 가져올 수 없습니다.');
      }

      // 3단계: DB에 채팅방 ID 저장
      await saveConversationIdToDB(phone, userId, conversationId);
      console.log('🆕 새 채팅방 생성 및 저장 완료:', conversationId);
    } else {
      console.log('♻️ 기존 채팅방 재사용:', conversationId);
    }

    // 4단계: 메시지 발송
    const messagePayload: any = {
      conversation_id: conversationId,
      text: text
    };

    if (blocks && blocks.length > 0) {
      messagePayload.blocks = blocks;
      console.log('🎨 카카오워크 메시지 블록 추가:', blocks.length, '개');
    }

    console.log('📋 메시지 발송 시작:', conversationId);

    const messageResponse = await fetch(`${KAKAOWORK_API_URL}/v1/messages.send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BOT_APP_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayload)
    });

    const messageText = await messageResponse.text();
    console.log('📡 메시지 발송 응답:', messageResponse.status, messageText);

    if (!messageResponse.ok) {
      console.error('❌ 메시지 발송 실패:', messageText);
      throw new Error(`메시지 발송 실패: ${messageText}`);
    }

    const messageData = JSON.parse(messageText);
    console.log('✅ 카카오워크 메시지 발송 성공:', messageData.message?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: messageData.message?.id,
        conversationId: conversationId,
        userName,
        isNewConversation: isNewConversation
      }),
      { status: 200, headers }
    );

  } catch (error: any) {
    console.error('❌ 카카오워크 메시지 발송 오류:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        message: error.message 
      }),
      { status: 500, headers }
    );
  }
}
