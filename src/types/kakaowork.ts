// types/kakaowork.ts

export interface KakaoWorkUser {
  id: string;
  name: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  status?: 'active' | 'inactive';
}

export interface KakaoWorkConversation {
  id: string;
  type: 'dm' | 'group';
  users: KakaoWorkUser[];
  name?: string;
  avatar_url?: string;
}

export interface KakaoWorkMessage {
  id: string;
  text: string;
  user: KakaoWorkUser;
  conversation_id: string;
  send_time: number;
  update_time?: number;
  blocks?: KakaoWorkBlock[];
}

export interface KakaoWorkBlock {
  type: 'text' | 'divider' | 'button' | 'button_group' | 'image';
  text?: string;
  markdown?: boolean;
  buttons?: KakaoWorkButton[];
  image_url?: string;
  alt_text?: string;
}

export interface KakaoWorkButton {
  type: 'button';
  text: string;
  style?: 'primary' | 'danger' | 'default';
  action_type: 'open_inapp_browser' | 'open_system_browser' | 'call' | 'compose';
  value: string;
}

export interface SendScheduleNotificationRequest {
  userId: string;
  userName: string;
  message: string;
  scheduleId: number;
  customBlocks?: KakaoWorkBlock[];
}

export interface KakaoWorkApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ScheduleInfo {
  id: number;
  shoot_date: string;
  start_time: string;
  end_time: string;
  professor_name: string;
  course_name: string;
  sub_locations?: {
    name: string;
    main_locations?: {
      name: string;
    };
  };
}

export interface NotificationLog {
  id?: number;
  schedule_id: number;
  user_id: string;
  user_name: string;
  message: string;
  status: 'success' | 'failed' | 'pending';
  error_message?: string;
  platform: 'kakaowork' | 'email' | 'sms';
  sent_at: string;
  created_at?: string;
}
