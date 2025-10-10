// ===== 기본 사용자 및 Shooter 타입 =====

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'professor' | 'shooter'; // professor → professor
  phone?: string;
  team_id?: number;
  academy_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Shooter extends User {
  role: 'shooter';
  hourly_rate?: number;
  bank_account?: string;
  specialties?: string[];
  preferred_shooting_type?: string;
  total_shoots?: number;
  rating?: number;
  last_active?: string;
}

// ===== 스케줄 관련 타입 =====

export interface Schedule {
  id: number;
  shoot_date: string;
  start_time: string;
  end_time: string;
  course_name: string;
  course_code?: string;
  professor_name: string; // professor_name → professor_name
  shooting_type: ShootingType;
  schedule_type: 'studio' | 'academy' | 'internal';
  approval_status: ApprovalStatus;
  tracking_status: TrackingStatus;
  sub_location_id: number;
  assigned_shooter_id?: number;
  team_id?: number;
  notes?: string;
  request_message?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  completion_photo_url?: string;
  settlement_amount?: number;
  settlement_status?: SettlementStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  approved_by?: number;
  cancelled_at?: string;
  deleted_at?: string;
}

export interface ScheduleWithLocation extends Schedule {
  location_name?: string;
  main_location_name?: string;
  main_location_id?: number;
  shooter_name?: string;
}

// ===== Shooter 액션 및 트랙킹 타입 =====

export type ShootingType = 'PPT' | '일반칠판' | '전자칠판' | '크로마키' | 'PC와콤' | 'PC';

export type ApprovalStatus = 'pending' | 'approved' | 'confirmed' | 'rejected' | 'cancelled';

export type TrackingStatus = 
  | 'scheduled' 
  | 'schedule_check' 
  | 'departure' 
  | 'arrival' 
  | 'start' 
  | 'end' 
  | 'completion';

export type ActionType = 
  | 'schedule_check'
  | 'departure'
  | 'arrival'
  | 'start'
  | 'end'
  | 'completion';

export interface ShooterAction {
  id: number;
  schedule_id: number;
  shooter_id: number;
  action_type: ActionType;
  action_timestamp: string;
  location_verified: boolean;
  qr_code_used?: string;
  notes?: string;
  photo_url?: string;
  is_on_time: boolean;
  created_at: string;
}

export interface ActionDeadline {
  id: number;
  schedule_id: number;
  action_type: ActionType;
  deadline_time: string;
  completed_at?: string;
  is_completed: boolean;
  reminder_sent: boolean;
  overdue_alert_sent: boolean;
  created_at: string;
}

// ===== QR 코드 관련 타입 =====

export interface QRCode {
  id: number;
  main_location_id: number;
  qr_code: string;
  generated_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface QRVerificationResult {
  is_valid: boolean;
  qr_code: string;
  location_name?: string;
  main_location_id?: number;
  generated_at?: string;
  expires_at?: string;
  time_remaining?: number;
  verification_timestamp: string;
}

// ===== 알림 관련 타입 =====

export interface Notification {
  id: number;
  user_id: number;
  sender_id?: number;
  related_schedule_id?: number;
  notification_type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export type NotificationType = 
  | 'shooter_schedule_check'
  | 'shooter_departure'
  | 'shooter_arrival'
  | 'shooter_start'
  | 'shooter_end'
  | 'shooter_completion'
  | 'shooter_overdue_schedule_check'
  | 'shooter_overdue_departure'
  | 'shooter_overdue_arrival'
  | 'professor_schedule_request' // 교수 스케줄 요청
  | 'professor_schedule_approved' // 교수 스케줄 승인
  | 'professor_schedule_rejected' // 교수 스케줄 거부
  | 'manager_approval_request'
  | 'admin_response_approved'
  | 'admin_response_rejected';

export interface NotificationSettings {
  id: number;
  action_type: ActionType;
  deadline_hours_before: number;
  reminder_hours_before?: number;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===== 정산 관련 타입 =====

export type SettlementStatus = 'pending' | 'calculated' | 'approved' | 'paid' | 'cancelled';

export interface Settlement {
  id: number;
  shooter_id: number;
  schedule_id: number;
  work_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  actual_start_time?: string;
  actual_end_time?: string;
  scheduled_minutes: number;
  actual_minutes?: number;
  minute_rate: number;
  base_amount: number;
  overtime_amount: number;
  total_amount: number;
  settlement_status: SettlementStatus;
  approved_by?: number;
  approved_at?: string;
  paid_at?: string;
  notes?: string;
  created_at: string;
}

export interface SettlementSummary {
  shooter_id: number;
  shooter_name: string;
  work_month: string;
  total_schedules: number;
  total_scheduled_minutes: number;
  total_actual_minutes: number;
  total_base_amount: number;
  total_overtime_amount: number;
  total_settlement_amount: number;
  paid_count: number;
  pending_count: number;
}

// ===== 위치 관련 타입 =====

export interface MainLocation {
  id: number;
  name: string;
  location_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubLocation {
  id: number;
  name: string;
  main_location_id: number;
  shooting_types?: string[];
  primary_shooting_type?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  main_locations?: MainLocation;
}

// ===== API 응답 타입 =====

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// ===== 대시보드 및 모니터링 타입 =====

export interface ShooterStatus {
  schedule_id: number;
  shoot_date: string;
  start_time: string;
  end_time: string;
  course_name: string;
  tracking_status: TrackingStatus;
  shooter_id: number;
  shooter_name: string;
  location_name: string;
  main_location_name: string;
  main_location_id: number;
  last_action_time?: string;
  last_action?: ActionType;
  is_on_time: boolean;
  status_korean: string;
  next_deadline?: string;
  next_action?: ActionType;
}

export interface DashboardStats {
  total_schedules: number;
  active_shooters: number;
  completed_today: number;
  overdue_actions: number;
  pending_notifications: number;
  by_team: { [key: string]: number };
  by_time: { [key: string]: number };
}

// ===== 폼 데이터 타입 =====

export interface ShooterActionFormData {
  schedule_id: number;
  shooter_id: number;
  action_type: ActionType;
  qr_code?: string;
  notes?: string;
  photo_url?: string;
}

export interface ScheduleFormData {
  shoot_date: string;
  start_time: string;
  end_time: string;
  course_name: string;
  course_code?: string;
  professor_name: string; // professor_name → professor_name
  shooting_type: ShootingType;
  sub_location_id: number;
  notes?: string;
}

export interface NotificationFormData {
  recipient_ids?: number[];
  recipient_roles?: string[];
  sender_id: number;
  schedule_id?: number;
  notification_type: NotificationType;
  title: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  auto_read_timeout?: number;
}

// ===== 필터 및 검색 타입 =====

export interface ShooterFilter {
  date_from?: string;
  date_to?: string;
  shooter_id?: number;
  tracking_status?: TrackingStatus[];
  shooting_type?: ShootingType[];
  main_location_id?: number;
  time_range?: 'morning' | 'afternoon' | 'night';
  is_overdue?: boolean;
}

export interface ScheduleFilter {
  date_from?: string;
  date_to?: string;
  schedule_type?: string;
  approval_status?: ApprovalStatus[];
  shooting_type?: ShootingType[];
  professor_name?: string; // professor_name → professor_name
  course_name?: string;
  main_location_id?: number;
}

// ===== 유틸리티 타입 =====

export interface TimeRange {
  label: string;
  value: string;
  start: string;
  end: string;
}

export interface StatusOption {
  value: TrackingStatus | ApprovalStatus;
  label: string;
  color: string;
}

export interface ActionOption {
  value: ActionType;
  label: string;
  description: string;
  color: string;
  icon?: string;
}

// ===== 에러 타입 =====

export interface ShooterError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export type ShooterErrorCode = 
  | 'INVALID_METHOD'
  | 'MISSING_REQUIRED_FIELDS'
  | 'UNAUTHORIZED_SHOOTER'
  | 'SCHEDULE_NOT_FOUND'
  | 'INVALID_QR_CODE'
  | 'DUPLICATE_ACTION'
  | 'DATABASE_ERROR'
  | 'INTERNAL_SERVER_ERROR'
  | 'INVALID_ACTION_TYPE'
  | 'LOCATION_MISMATCH'
  | 'QR_EXPIRED'
  | 'UPLOAD_FAILED'
  | 'NO_RECIPIENTS'
  | 'SENDER_NOT_FOUND';

// ===== 상수 타입 =====

export const SHOOTING_TYPES: ShootingType[] = [
  'PPT',
  '일반칠판', 
  '전자칠판',
  '크로마키',
  'PC와콤',
  'PC'
];

export const ACTION_FLOW: ActionType[] = [
  'schedule_check',
  'departure',
  'arrival', 
  'start',
  'end',
  'completion'
];

export const TIME_RANGES: TimeRange[] = [
  { label: '전체', value: 'all', start: '00:00', end: '23:59' },
  { label: '오전 (06:00-12:00)', value: 'morning', start: '06:00', end: '12:00' },
  { label: '오후 (12:00-18:00)', value: 'afternoon', start: '12:00', end: '18:00' },
  { label: '야간 (18:00-24:00)', value: 'night', start: '18:00', end: '24:00' }
];

// ===== 헬퍼 타입 가드 =====

export function isShooter(user: User): user is Shooter {
  return user.role === 'shooter';
}

export function isProfessor(user: User): boolean {
  return user.role === 'professor';
}

export function isValidActionType(action: string): action is ActionType {
  return ACTION_FLOW.includes(action as ActionType);
}

export function isValidShootingType(type: string): type is ShootingType {
  return SHOOTING_TYPES.includes(type as ShootingType);
}

// ===== 컴포넌트 Props 타입 =====

export interface ShooterDashboardProps {
  shooterId?: number;
  initialDate?: string;
}

export interface ActionButtonsProps {
  schedule?: Schedule;
  onActionComplete?: (actionType: ActionType) => void;
}

export interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (qrCode: string) => void;
  onScanError?: (error: string) => void;
  title?: string;
  description?: string;
}

export interface MonitoringDashboardProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
  defaultFilters?: ShooterFilter;
}

export interface NotificationCenterProps {
  userId: number;
  userRole: string;
  maxNotifications?: number;
  autoMarkRead?: boolean;
}
