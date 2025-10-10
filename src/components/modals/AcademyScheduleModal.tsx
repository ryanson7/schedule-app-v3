"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { ProfessorAutocomplete } from '../ProfessorAutocomplete';

interface AcademyScheduleModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: any;
  locations: any[];
  userRole: string;
  onSave: (data: any, action: 'temp' | 'request' | 'approve' | 'modify_request' | 'cancel_request' | 'delete_request' | 'modify_approve' | 'cancel_approve' | 'delete_approve' | 'cancel' | 'delete' | 'cancel_cancel' | 'cancel_delete' | 'approve_modification') => Promise<{ success: boolean; message: string }>;
}

// 🔥 새로운 고도화된 히스토리 컴포넌트 (스튜디오와 동일)
// 🔥 새로운 고도화된 히스토리 컴포넌트 (변경 내역 상세 표시)
const EnhancedScheduleHistory = ({ scheduleId }: { scheduleId: number }) => {
  const [scheduleHistory, setScheduleHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchScheduleHistory = async (scheduleId: number) => {
    if (!scheduleId) return;

    setLoadingHistory(true);
    
    try {
      console.log('📜 학원 스케줄 히스토리 조회 시작:', scheduleId);

      // 1. schedule_history 테이블에서 변경 기록 조회
      const { data: historyData, error: historyError } = await supabase
        .from('schedule_history')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('created_at', { ascending: false });

      if (historyError) {
        console.error('히스토리 조회 오류:', historyError);
      }

      // 2. schedules 테이블에서 기본 정보 조회
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();

      if (scheduleError) {
        console.error('스케줄 데이터 조회 오류:', scheduleError);
      }

      // 🔥 강의실 정보 매핑을 위한 데이터 조회
      const { data: locationData, error: locationError } = await supabase
        .from('sub_locations')
        .select(`
          id, 
          name,
          main_locations(id, name)
        `);

      const locationMap = new Map();
      if (locationData) {
        locationData.forEach(loc => {
          locationMap.set(loc.id, `${loc.main_locations?.name} - ${loc.name}`);
        });
      }

      // 🔥 변경 내용을 상세히 파싱하는 함수
      // 🔥 변경 내용을 상세히 파싱하는 함수 (정확도 개선)
      const parseDetailedChanges = (oldData: any, newData: any): { 
        changes: Array<{field: string, oldValue: any, newValue: any, displayName: string}>,
        summary: string 
      } => {
        const changes: Array<{field: string, oldValue: any, newValue: any, displayName: string}> = [];
        
        if (!oldData || !newData) {
          return { changes: [], summary: '새로운 스케줄이 생성되었습니다.' };
        }

        // 추적할 필드들과 표시명
        const trackFields = [
          { field: 'shoot_date', displayName: '촬영일', type: 'date' },
          { field: 'start_time', displayName: '시작시간', type: 'time' },
          { field: 'end_time', displayName: '종료시간', type: 'time' },
          { field: 'professor_name', displayName: '교수명', type: 'text' },
          { field: 'course_name', displayName: '강의명', type: 'text' },
          { field: 'course_code', displayName: '강의코드', type: 'text' },
          { field: 'shooting_type', displayName: '촬영형식', type: 'text' },
          { field: 'sub_location_id', displayName: '강의실', type: 'location' },
          { field: 'notes', displayName: '비고', type: 'text' }
          // 🔥 approval_status는 제외 (시스템 변경이므로 사용자 변경이 아님)
        ];

        // 🔥 값 정규화 함수 (비교 전 동일한 형태로 변환)
        const normalizeValue = (value: any, type: string) => {
          if (value === null || value === undefined || value === '') return '';
          
          switch (type) {
            case 'time':
              // 시간은 HH:MM 형식으로 정규화
              return String(value).substring(0, 5);
            case 'location':
              // 강의실 ID는 문자열로 정규화
              return String(value);
            case 'text':
              // 텍스트는 트림 후 비교
              return String(value).trim();
            case 'date':
              // 날짜는 YYYY-MM-DD 형식으로 정규화
              return String(value).substring(0, 10);
            default:
              return String(value);
          }
        };

        trackFields.forEach(({ field, displayName, type }) => {
          const oldValue = normalizeValue(oldData[field], type);
          const newValue = normalizeValue(newData[field], type);
          
          // 🔥 정규화된 값으로 실제 변경 여부 확인
          if (oldValue !== newValue && !(oldValue === '' && newValue === '')) {
            let formattedOldValue = oldValue || '없음';
            let formattedNewValue = newValue || '없음';

            // 표시용 포맷팅
            switch (type) {
              case 'date':
                if (oldValue) formattedOldValue = new Date(oldData[field]).toLocaleDateString('ko-KR');
                if (newValue) formattedNewValue = new Date(newData[field]).toLocaleDateString('ko-KR');
                break;
              case 'time':
                // 이미 HH:MM 형식으로 정규화됨
                formattedOldValue = oldValue || '미지정';
                formattedNewValue = newValue || '미지정';
                break;
              case 'location':
                if (oldValue) formattedOldValue = locationMap.get(parseInt(oldValue)) || `강의실 ${oldValue}`;
                if (newValue) formattedNewValue = locationMap.get(parseInt(newValue)) || `강의실 ${newValue}`;
                break;
            }

            changes.push({
              field,
              oldValue: formattedOldValue,
              newValue: formattedNewValue,
              displayName
            });
          }
        });

        // 요약 메시지 생성
        let summary = '';
        if (changes.length === 0) {
          summary = '상태만 변경되었습니다.';
        } else if (changes.length === 1) {
          const change = changes[0];
          summary = `${change.displayName}이(가) "${change.oldValue}"에서 "${change.newValue}"(으)로 변경되었습니다.`;
        } else {
          const fieldNames = changes.map(c => c.displayName).join(', ');
          summary = `${fieldNames} 등 ${changes.length}개 항목이 변경되었습니다.`;
        }

        return { changes, summary };
      };


      // 🔥 사용자명 변환 함수 (동적 조회로 개선)
      const getUserDisplayName = async (changedBy: any): Promise<string> => {
        if (!changedBy) return getCurrentUserName();
        
        // 이미 한글 이름인 경우
        if (typeof changedBy === 'string' && isNaN(Number(changedBy))) {
          return changedBy;
        }

        // 🔥 실제 DB에서 사용자 정보 조회
        try {
          const { data: userData, error } = await supabase
            .from('user_profiles')
            .select('name, display_name')
            .eq('id', changedBy)
            .single();

          if (!error && userData) {
            return userData.display_name || userData.name || getCurrentUserName();
          }
        } catch (error) {
          console.warn('사용자 정보 조회 실패:', changedBy, error);
        }
        
        return getCurrentUserName();
      };

      const getCurrentUserName = () => {
        const userName = localStorage.getItem('userName') || localStorage.getItem('displayName');
        const userRole = localStorage.getItem('userRole');
        
        if (userRole === 'system_admin') {
          return userName || '시스템 관리자';
        } else if (userRole === 'academy_manager') {
          return userName || '학원 매니저';
        }
        return userName || '관리자';
      };

      const currentUserName = getCurrentUserName();

      // 3. 히스토리 생성 (중복 제거를 위해 Map 사용)
      const historyMap = new Map<string, any>();

      // 기본 히스토리
      if (scheduleData) {
        // 등록 기록
        historyMap.set(`created_${scheduleData.id}`, {
          id: `created_${scheduleData.id}`,
          action: '등록됨',
          reason: '최초 스케줄 등록',
          changed_by: '매니저',
          created_at: scheduleData.created_at,
          details: `${scheduleData.professor_name} 교수님 학원 스케줄이 등록되었습니다.`,
          changes: [],
          source: 'system'
        });

        // 승인 상태 기록
        if (scheduleData.approval_status === 'approved') {
          historyMap.set(`approved_${scheduleData.id}`, {
            id: `approved_${scheduleData.id}`,
            action: '승인완료',
            reason: '관리자 승인 처리',
            changed_by: currentUserName,
            created_at: scheduleData.updated_at || scheduleData.created_at,
            details: `${scheduleData.professor_name} 교수님 학원 스케줄이 승인 완료되었습니다.`,
            changes: [],
            source: 'system'
          });
        }

        if (scheduleData.approval_status === 'cancelled') {
          historyMap.set(`cancelled_${scheduleData.id}`, {
            id: `cancelled_${scheduleData.id}`,
            action: '취소완료',
            reason: '관리자 취소 승인',
            changed_by: currentUserName,
            created_at: scheduleData.updated_at || scheduleData.created_at,
            details: `${scheduleData.professor_name} 교수님 학원 스케줄이 취소 처리되었습니다.`,
            changes: [],
            source: 'system'
          });
        }
      }

      // schedule_history 데이터 추가
      if (historyData && historyData.length > 0) {
        // 중복 제거
        const uniqueHistory = historyData.reduce((acc: any[], current) => {
          const timeKey = new Date(current.created_at).getTime();
          const existing = acc.find(item => 
            Math.abs(new Date(item.created_at).getTime() - timeKey) < 5000 &&
            item.change_type === current.change_type
          );
          
          if (!existing) {
            acc.push(current);
          }
          return acc;
        }, []);

        // 모든 히스토리 추가
        for (const item of uniqueHistory) {
          const key = `history_${item.id}`;
          
          if (!historyMap.has(key)) {
            let actionName = item.change_type;
            let reasonText = item.description || '';
            
            // 액션명 한글화
            switch (item.change_type) {
              case 'temp':
                actionName = '임시저장';
                break;
              case 'request':
                actionName = '승인요청';
                break;
              case 'approve':
                actionName = '승인완료';
                break;
              case 'modify_request':
                actionName = '수정요청';
                break;
              case 'approve_modification':
                actionName = '수정권한승인';
                break;
              case 'modify_approve':
                actionName = '수정승인완료';
                break;
              case 'cancel_request':
                actionName = '취소요청';
                break;
              case 'cancel_approve':
                actionName = '취소승인완료';
                break;
              case 'delete_request':
                actionName = '삭제요청';
                break;
              case 'delete_approve':
                actionName = '삭제승인완료';
                break;
              case 'cancel_cancel':
                actionName = '요청철회';
                break;
              case 'cancel_delete':
                actionName = '삭제요청철회';
                break;
              case 'cancel':
                actionName = '직접취소';
                break;
              case 'delete':
                actionName = '직접삭제';
                break;
            }

            const changedByName = await getUserDisplayName(item.changed_by);

            // 🔥 상세 변경 내용 파싱
            let oldDataParsed = null;
            let newDataParsed = null;
            let detailsText = reasonText;
            let changesList: any[] = [];

            try {
              if (item.old_value) oldDataParsed = JSON.parse(item.old_value);
              if (item.new_value) newDataParsed = JSON.parse(item.new_value);
              
              if (oldDataParsed && newDataParsed) {
                const { changes, summary } = parseDetailedChanges(oldDataParsed, newDataParsed);
                changesList = changes;
                if (changes.length > 0) {
                  detailsText = `${reasonText} - ${summary}`;
                }
              }
            } catch (error) {
              console.warn('히스토리 데이터 파싱 오류:', error);
            }

            historyMap.set(key, {
              id: key,
              action: actionName,
              reason: reasonText,
              changed_by: changedByName,
              created_at: item.created_at,
              details: detailsText,
              changes: changesList,
              source: 'history'
            });
          }
        }
      }

      // 시간 순으로 정렬
      const allHistory = Array.from(historyMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setScheduleHistory(allHistory);
      console.log('✅ 학원 히스토리 조회 완료:', allHistory.length, '개');

    } catch (error) {
      console.error('학원 히스토리 조회 오류:', error);
      setScheduleHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (scheduleId) {
      fetchScheduleHistory(scheduleId);
    }
  }, [scheduleId]);

  // 🔥 히스토리 아이템 스타일 함수
  const historyItemStyle = (action: string) => {
    switch (action) {
      case "취소완료":
      case "취소승인완료":
      case "직접취소":
        return {
          backgroundColor: "#fef2f2",
          borderColor: "#fecaca",
          padding: "12px",
          marginBottom: "8px",
          border: "1px solid #fecaca",
          borderRadius: "6px",
        };
      case "수정요청":
      case "수정권한승인":
      case "수정승인완료":
        return {
          backgroundColor: "#f0fdf4",
          borderColor: "#bbf7d0",
          padding: "12px",
          marginBottom: "8px",
          border: "1px solid #bbf7d0",
          borderRadius: "6px",
        };
      case "승인완료":
      case "승인요청":
        return {
          backgroundColor: "#eff6ff",
          borderColor: "#dbeafe",
          padding: "12px",
          marginBottom: "8px",
          border: "1px solid #dbeafe",
          borderRadius: "6px",
        };
      case "등록됨":
        return {
          backgroundColor: "#fefce8",
          borderColor: "#fde047",
          padding: "12px",
          marginBottom: "8px",
          border: "1px solid #fde047",
          borderRadius: "6px",
        };
      default:
        return {
          backgroundColor: "#f9fafb",
          borderColor: "#e5e7eb",
          padding: "12px",
          marginBottom: "8px",
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
        };
    }
  };

  if (!scheduleId) return null;

  return (
    <div>
      {loadingHistory ? (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px', fontSize: '14px' }}>
          히스토리를 불러오는 중...
        </div>
      ) : scheduleHistory.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px', fontSize: '14px' }}>
          변경 이력이 없습니다.
        </div>
      ) : (
        <div style={{ maxHeight: '100%', overflowY: 'auto' }}>
          {scheduleHistory.map(item => (
            <div key={item.id} style={historyItemStyle(item.action)}>
              <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', fontSize: '14px' }}>
                {item.action}
              </p>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>
                {new Date(item.created_at).toLocaleString()}
              </p>
              <p style={{ margin: '0 0 6px 0', fontSize: '12px' }}>
                처리자: {item.changed_by}
              </p>
              
              {/* 🔥 상세 변경 내용 표시 */}
              {item.changes && item.changes.length > 0 && (
                <div style={{ 
                  marginBottom: '8px',
                  padding: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>
                    📝 변경 내용:
                  </div>
                  {item.changes.map((change: any, index: number) => (
                    <div key={index} style={{ 
                      marginBottom: '2px',
                      color: '#4b5563',
                      lineHeight: 1.4
                    }}>
                      • <strong>{change.displayName}:</strong> {change.oldValue} → {change.newValue}
                    </div>
                  ))}
                </div>
              )}
              
              <p style={{ margin: '0', fontSize: '12px', lineHeight: 1.4 }}>
                {item.details}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


// 🔥 사유 입력 모달 (기존 그대로 유지)
const ReasonModal = ({ 
  open, 
  type, 
  onClose, 
  onSubmit 
}: {
  open: boolean;
  type: 'modify' | 'cancel' | 'delete';
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) => {
  const [reason, setReason] = useState('');

  const titles = {
    modify: '수정 요청 사유',
    cancel: '취소 요청 사유', 
    delete: '삭제 요청 사유'
  };

  const placeholders = {
    modify: '수정이 필요한 이유를 입력해주세요...',
    cancel: '취소가 필요한 이유를 입력해주세요...',
    delete: '삭제가 필요한 이유를 입력해주세요...'
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '400px',
        maxWidth: '90vw',
        padding: '24px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
          {titles[type]}
        </h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholders[type]}
          rows={4}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            outline: 'none',
            resize: 'vertical',
            marginBottom: '16px'
          }}
        />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            취소
          </button>
          <button
            onClick={() => {
              if (!reason.trim()) {
                alert('사유를 입력해주세요.');
                return;
              }
              onSubmit(reason.trim());
              setReason('');
            }}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: '#2563eb',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            요청 전송
          </button>
        </div>
      </div>
    </div>
  );
};

export default function AcademyScheduleModal({
  open,
  onClose,
  initialData,
  locations,
  userRole,
  onSave
}: AcademyScheduleModalProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [userIdLoading, setUserIdLoading] = useState(true);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [requestType, setRequestType] = useState<'modify' | 'cancel' | 'delete'>('modify');
  
  // 강의실 데이터 로딩을 위한 상태
  const [availableLocations, setAvailableLocations] = useState<any[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);

  // 🔥 사용자 ID 조회 (기존 로직 유지)
  useEffect(() => {
    const getCurrentUserId = async () => {
      if (!open) return;
      
      try {
        setUserIdLoading(true);
        console.log('🔍 사용자 ID 조회 시작...');

        const storedUserName = localStorage.getItem('userName');
        const storedUserRole = localStorage.getItem('userRole');
        
        console.log('📦 localStorage 정보:', {
          userName: storedUserName,
          userRole: storedUserRole
        });

        let mappedUserId: number | null = null;

        if (storedUserName && storedUserRole) {
          const userMapping: { [key: string]: number } = {
            'system_admin': 1,
            'schedule_admin': 2,
            'academy_manager': 3,
            'studio_manager': 4,
            '테스트관리자': 1,
            '테스트매니저': 3,
            'manager1': 1
          };

          if (userMapping[storedUserName]) {
            mappedUserId = userMapping[storedUserName];
            console.log(`✅ 사용자명(${storedUserName})으로 ID 매핑: ${mappedUserId}`);
          }
          else if (userMapping[storedUserRole]) {
            mappedUserId = userMapping[storedUserRole];
            console.log(`✅ 역할(${storedUserRole})로 ID 매핑: ${mappedUserId}`);
          }
          else {
            mappedUserId = 1;
            console.log(`⚠️ 기본 ID 사용: ${mappedUserId}`);
          }
        }

        if (mappedUserId) {
          setCurrentUserId(mappedUserId);
          setUserIdLoading(false);
          return;
        }

        const storedUserId = localStorage.getItem('userId');
        if (storedUserId && storedUserId !== 'null' && storedUserId !== 'undefined') {
          const parsedUserId = parseInt(storedUserId);
          if (!isNaN(parsedUserId) && parsedUserId > 0) {
            console.log('✅ localStorage에서 사용자 ID 획득:', parsedUserId);
            setCurrentUserId(parsedUserId);
            setUserIdLoading(false);
            return;
          }
        }

        try {
          console.log('🔍 Supabase 인증 확인 중...');
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          
          if (!authError && user) {
            console.log('👤 인증된 사용자:', user.email);

            const { data: profile, error: profileError } = await supabase
              .from('user_profiles')
              .select('id, name, email')
              .eq('auth_user_id', user.id)
              .single();

            if (!profileError && profile) {
              console.log('✅ user_profiles에서 사용자 정보 획득:', profile);
              localStorage.setItem('userId', profile.id.toString());
              setCurrentUserId(profile.id);
              setUserIdLoading(false);
              return;
            }
          }
        } catch (authError) {
          console.warn('⚠️ Supabase 인증 실패 (무시하고 계속):', authError);
        }

        const fallbackUserId = 1;
        console.warn('⚠️ 최종 기본 사용자 ID 사용:', fallbackUserId);
        setCurrentUserId(fallbackUserId);
        
      } catch (error) {
        console.error('❌ 사용자 ID 조회 실패:', error);
        
        const fallbackUserId = 1;
        console.warn('⚠️ 오류로 인한 기본 사용자 ID 사용:', fallbackUserId);
        setCurrentUserId(fallbackUserId);
        
      } finally {
        setUserIdLoading(false);
      }
    };

    getCurrentUserId();
  }, [open]);

  // 🔥 강의실 데이터 로딩 (기존 로직 유지)
  useEffect(() => {
    const fetchLocationData = async () => {
      if (!open) return;
      
      try {
        setLocationLoading(true);
        console.log('🏢 강의실 데이터 로딩 시작...');

        const userRole = localStorage.getItem('userRole') || '';
        const userName = localStorage.getItem('userName') || '';
        
        let query = supabase
          .from('sub_locations')
          .select(`
            *,
            main_locations!inner(*)
          `)
          .eq('is_active', true)
          .eq('main_locations.location_type', 'academy')
          .order('main_location_id')
          .order('id');

        if (userRole === 'academy_manager') {
          const assignedAcademyIds = JSON.parse(localStorage.getItem('assignedAcademyIds') || '[]');
          if (assignedAcademyIds.length > 0) {
            query = query.in('main_location_id', assignedAcademyIds);
          }
        }

        const { data, error } = await query;

        if (error) {
          console.error('🔥 강의실 조회 오류:', error);
          throw error;
        }

        console.log('✅ 강의실 데이터 조회 완료:', data?.length, '개');
        
        const formattedLocations = (data || []).map(loc => ({
          ...loc,
          displayName: `${loc.main_locations.name} - ${loc.name}`,
          fullName: `${loc.main_locations.name} - ${loc.name}`
        }));

        setAvailableLocations(formattedLocations);
        
      } catch (error) {
        console.error('❌ 강의실 데이터 로딩 실패:', error);
        setAvailableLocations([]);
      } finally {
        setLocationLoading(false);
      }
    };

    fetchLocationData();
  }, [open]);

  // 🔥 초기 폼 데이터 설정 (기존 로직 유지 + 교수 필드 추가)
  const getInitValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  };

  const formatTimeForInput = (timeValue: any): string => {
    if (!timeValue) return '';
    const timeStr = String(timeValue).trim();
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      }
    }
    return timeStr;
  };

  const getInitialFormData = () => {
    const scheduleData = initialData?.scheduleData;
    const isEditMode = !!(scheduleData && scheduleData.id);
    
    if (isEditMode) {
      return {
        shoot_date: getInitValue(scheduleData.shoot_date || initialData.date),
        start_time: formatTimeForInput(scheduleData.start_time),
        end_time: formatTimeForInput(scheduleData.end_time),
        professor_name: getInitValue(scheduleData.professor_name),
        course_name: getInitValue(scheduleData.course_name),
        course_code: getInitValue(scheduleData.course_code),
        shooting_type: getInitValue(scheduleData.shooting_type || '촬영'),
        notes: getInitValue(scheduleData.notes),
        sub_location_id: getInitValue(scheduleData.sub_location_id || initialData.locationId)
      };
    } else {
      return {
        shoot_date: getInitValue(initialData?.date),
        start_time: '',
        end_time: '',
        professor_name: '',
        course_name: '',
        course_code: '',
        shooting_type: '촬영',
        notes: '',
        sub_location_id: getInitValue(initialData?.locationId)
      };
    }
  };

  const [formData, setFormData] = useState(getInitialFormData);

  // 🔥 교수 자동완성 처리 함수 - UI용 카테고리 정보는 상태에만 저장, 실제 저장시에는 제외
  const [selectedProfessorInfo, setSelectedProfessorInfo] = useState<any>(null);
  
  const handleProfessorChange = (value: string, professor?: any) => {
    setFormData(prev => ({
      ...prev,
      professor_name: value
    }));

    // UI용 교수 정보는 별도 상태에 저장 (실제 저장시에는 사용하지 않음)
    if (professor) {
      setSelectedProfessorInfo({
        id: professor.id,
        category_name: professor.category_name
      });
    } else {
      setSelectedProfessorInfo(null);
    }
  };

  useEffect(() => {
    if (!open) {
      setSaving(false);
      setMessage('');
      setUserIdLoading(true);
      setSelectedProfessorInfo(null);
    }
  }, [open]);

  useEffect(() => {
    const newFormData = getInitialFormData();
    setFormData(newFormData);
    setSelectedProfessorInfo(null);
    console.log('🔧 모달 데이터 변경됨 - 폼 데이터 업데이트:', {
      currentStatus: initialData?.scheduleData?.approval_status,
      newFormData
    });
  }, [initialData?.scheduleData?.approval_status]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open && !saving) {
        onClose();
      }
    };
    
    if (open) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, saving, onClose]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 🔥 권한 확인 함수 (기존 로직 유지)
  const getUserPermissions = () => {
    const currentUserRole = localStorage.getItem('userRole') || '';
    const userName = localStorage.getItem('userName') || '';
    
    if (userName === 'manager1' || currentUserRole === 'system_admin' || currentUserRole === 'schedule_admin') {
      return { roleType: 'admin' as const };
    }
    
    if (currentUserRole === 'academy_manager') {
      return { roleType: 'manager' as const };
    }
    
    return { roleType: 'basic' as const };
  };

  const permissions = getUserPermissions();
  const isEditMode = !!(initialData?.scheduleData && initialData.scheduleData.id);
  
  // 현재 스케줄 데이터 정의
  const modalData = initialData;
  const scheduleData = modalData?.scheduleData || null;
  const currentStatus = scheduleData?.approval_status || 'pending';
  const isInactive = scheduleData?.is_active === false;

  // 수정 상태 정의
  const isAfterApproval = ['approved', 'confirmed'].includes(currentStatus);
  const isAfterApprovalRequest = ['approval_requested', 'approved', 'confirmed'].includes(currentStatus);
  const isModificationInProgress = currentStatus === 'modification_approved';
  const isModificationRequested = currentStatus === 'modification_requested';
  const isCancellationInProgress = ['cancellation_requested'].includes(currentStatus);
  const isDeletionInProgress = ['deletion_requested'].includes(currentStatus);

  console.log('🔧 수정 중 상태 확인:', {
    permissions: permissions.roleType,
    isEditMode,
    currentStatus,
    isAfterApproval,
    isModificationInProgress,
    isModificationRequested,
    isCancellationInProgress,
    isDeletionInProgress
  });

  const validateFieldsForAction = (action: string) => {
    const skipValidationActions = [
      'modify_request', 'cancel_request', 'delete_request', 
      'cancel_approve', 'delete_approve', 'cancel', 'delete', 
      'cancel_cancel', 'cancel_delete'
    ];
    
    if (skipValidationActions.includes(action)) {
      return [];
    }

    const requiredFields = [
      { field: 'shoot_date', label: '촬영 날짜' },
      { field: 'start_time', label: '시작 시간' },
      { field: 'end_time', label: '종료 시간' },
      { field: 'professor_name', label: '교수명' },
      { field: 'shooting_type', label: '촬영형식' },
      { field: 'sub_location_id', label: '강의실' }
    ];
    
    const emptyRequiredFields = requiredFields.filter(field => 
      !formData[field.field as keyof typeof formData] || 
      formData[field.field as keyof typeof formData].toString().trim() === '' ||
      formData[field.field as keyof typeof formData].toString() === '0'
    );
    return emptyRequiredFields;
  };

  const handleSave = async (action: string, reason?: string) => {
    if (userIdLoading) {
      setMessage('사용자 정보를 확인하는 중입니다. 잠시만 기다려주세요.');
      return;
    }

    if (!currentUserId) {
      setMessage('사용자 정보를 확인할 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.');
      return;
    }

    setSaving(true);
    setMessage('');
    
    try {
      const emptyFields = validateFieldsForAction(action);
      if (emptyFields.length > 0) {
        const fieldNames = emptyFields.map(field => field.label).join(', ');
        throw new Error(`다음 필수 필드를 입력해주세요: ${fieldNames}`);
      }

      // 🔥 schedules 테이블에 존재하는 필드만 포함하여 데이터 생성
      const formDataWithUser = {
        ...formData, // 기존 폼 데이터 (professor_id, professor_category 제외)
        currentUserId: currentUserId,
        reason: reason || ''
        // professor_id, professor_category 필드는 제외 (schedules 테이블에 없음)
      };

      console.log('💾 저장 시도:', { action, currentUserId, formDataWithUser });

      const result = await onSave(formDataWithUser, action as any);
      setMessage(result.message);
      
      if (result.success) {
        alert(result.message);
        onClose();
        setMessage('');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.';
      setMessage(errorMessage);
      alert(errorMessage);
      console.error('저장 오류:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestWithReason = (reason: string) => {
    setReasonModalOpen(false);
    
    const actionMap = {
      modify: 'modify_request',
      cancel: 'cancel_request',
      delete: 'delete_request'
    };
    
    handleSave(actionMap[requestType], reason);
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 7; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();
  const academyShootingTypes = ['촬영', '중계', '(본사)촬영', '라이브촬영', '라이브중계', '(NAS)촬영'];

  const getSafeLocationOptions = () => {
    const baseOptions = [{ value: '', label: '강의실 선택' }];
    
    if (locationLoading) {
      return [...baseOptions, { value: 'loading', label: '강의실 정보 로딩 중...' }];
    }
    
    if (!availableLocations || availableLocations.length === 0) {
      return [...baseOptions, { value: 'no-data', label: '강의실 정보 없음 (관리자 문의)' }];
    }
    
    const locationOptions = availableLocations.map(location => {
      const label = location.displayName || location.fullName || location.name || `강의실 ${location.id}`;
      return { value: location.id.toString(), label: label };
    });
    
    return [...baseOptions, ...locationOptions];
  };

  // 수정 중 상태 필드 수정 권한
  const getFieldDisabled = () => {
    // 기본 비활성화 조건
    if (saving || userIdLoading || isInactive) {
      return true;
    }

    // 관리자는 모든 상태에서 수정 가능
    if (permissions.roleType === 'admin') {
      return false;
    }

    // 매니저 권한 체크
    if (permissions.roleType === 'manager') {
      // 수정 중(modification_approved) 상태에서는 수정 가능
      if (isModificationInProgress) {
        console.log('✅ 수정 중 상태 - 필드 수정 가능');
        return false;
      }

      // 수정요청 대기 중에는 수정 불가
      if (isModificationRequested) {
        console.log('🚫 수정요청 대기 중 - 수정 불가');
        return true;
      }

      // 승인된 스케줄은 수정요청을 통해서만 수정 가능
      if (isAfterApproval) {
        console.log('🚫 승인된 스케줄 - 수정요청 필요:', { currentStatus, isAfterApproval });
        return true;
      }

      // 승인요청 후에는 수정 불가 (승인 전 상태 제외)
      if (isAfterApprovalRequest && currentStatus !== 'pending') {
        console.log('🚫 승인요청 후 - 수정 불가:', { currentStatus });
        return true;
      }

      // 나머지 경우는 수정 가능
      return false;
    }

    // 기본 사용자는 수정 불가
    return true;
  };

  const fieldDisabled = getFieldDisabled();

  console.log('🔧 필드 수정 권한 최종 확인:', {
    fieldDisabled,
    permissions: permissions.roleType,
    currentStatus,
    isModificationInProgress,
    isAfterApproval
  });

  // 🔥 버튼 렌더링 함수 (기존 로직 완전 유지)
  const renderActionButtons = () => {
    const emptyRequiredFields = validateFieldsForAction('temp');
    const canSave = !saving && !userIdLoading && emptyRequiredFields.length === 0 && !isInactive && currentUserId;

    const buttonStyle = {
      padding: '10px 16px',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500'
    };

    const buttons = [];

    buttons.push(
      <button
        key="close"
        onClick={onClose}
        disabled={saving}
        style={{
          ...buttonStyle,
          border: '1px solid #d1d5db',
          backgroundColor: 'white',
          color: '#374151',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.5 : 1
        }}
      >
        닫기
      </button>
    );

    if (isInactive) {
      return buttons;
    }

    const isDisabled = saving || userIdLoading || !currentUserId;

    if (permissions.roleType === 'admin') {
      // 관리자 버튼 로직
      buttons.push(
        <button 
          key="temp" 
          onClick={() => handleSave('temp')} 
          disabled={!canSave} 
          style={{
            ...buttonStyle, 
            backgroundColor: canSave ? '#6b7280' : '#d1d5db', 
            color: 'white'
          }}
        >
          임시저장
        </button>
      );

      if (!isEditMode) {
        buttons.push(
          <button 
            key="approve" 
            onClick={() => handleSave('approve')} 
            disabled={!canSave} 
            style={{
              ...buttonStyle, 
              backgroundColor: canSave ? '#059669' : '#d1d5db', 
              color: 'white'
            }}
          >
            승인
          </button>
        );
      } else {
        buttons.push(
          <button 
            key="approve" 
            onClick={() => handleSave('modify_approve')} 
            disabled={!canSave} 
            style={{
              ...buttonStyle, 
              backgroundColor: canSave ? '#059669' : '#d1d5db', 
              color: 'white'
            }}
          >
            승인
          </button>
        );

        // 수정요청 승인 버튼 (수정 권한 부여)
        if (currentStatus === 'modification_requested') {
          buttons.push(
            <button 
              key="approve_modification"
              onClick={() => handleSave('approve_modification')} 
              disabled={isDisabled} 
              style={{
                ...buttonStyle, 
                backgroundColor: isDisabled ? '#d1d5db' : '#8b5cf6', 
                color: 'white'
              }}
            >
              수정권한부여
            </button>
          );
        }

        if (currentStatus === 'cancellation_requested') {
          buttons.push(
            <button 
              key="cancel_approve"
              onClick={() => handleSave('cancel_approve')} 
              disabled={isDisabled} 
              style={{
                ...buttonStyle, 
                backgroundColor: isDisabled ? '#d1d5db' : '#f59e0b', 
                color: 'white'
              }}
            >
              취소승인
            </button>
          );

          buttons.push(
            <button 
              key="cancel_cancel"
              onClick={() => handleSave('cancel_cancel')} 
              disabled={isDisabled} 
              style={{
                ...buttonStyle, 
                backgroundColor: isDisabled ? '#d1d5db' : '#6b7280', 
                color: 'white'
              }}
            >
              취소거부
            </button>
          );
        }

        if (currentStatus === 'deletion_requested') {
          buttons.push(
            <button 
              key="delete_approve"
              onClick={() => handleSave('delete_approve')} 
              disabled={isDisabled} 
              style={{
                ...buttonStyle, 
                backgroundColor: isDisabled ? '#d1d5db' : '#dc2626', 
                color: 'white'
              }}
            >
              삭제승인
            </button>
          );

          buttons.push(
            <button 
              key="cancel_delete"
              onClick={() => handleSave('cancel_delete')} 
              disabled={isDisabled} 
              style={{
                ...buttonStyle, 
                backgroundColor: isDisabled ? '#d1d5db' : '#6b7280', 
                color: 'white'
              }}
            >
              삭제거부
            </button>
          );
        }

        buttons.push(
          <button 
            key="cancel" 
            onClick={() => handleSave('cancel')} 
            disabled={isDisabled} 
            style={{
              ...buttonStyle, 
              backgroundColor: isDisabled ? '#d1d5db' : '#f59e0b', 
              color: 'white'
            }}
          >
            취소
          </button>
        );

        buttons.push(
          <button 
            key="delete" 
            onClick={() => handleSave('delete')} 
            disabled={isDisabled} 
            style={{
              ...buttonStyle, 
              backgroundColor: isDisabled ? '#d1d5db' : '#dc2626', 
              color: 'white'
            }}
          >
            삭제
          </button>
        );
      }
    } else if (permissions.roleType === 'manager') {
      if (!isEditMode) {
        buttons.push(
          <button 
            key="temp" 
            onClick={() => handleSave('temp')} 
            disabled={!canSave} 
            style={{
              ...buttonStyle, 
              backgroundColor: canSave ? '#6b7280' : '#d1d5db', 
              color: 'white'
            }}
          >
            임시저장
          </button>
        );

        buttons.push(
          <button 
            key="request" 
            onClick={() => handleSave('request')} 
            disabled={!canSave} 
            style={{
              ...buttonStyle, 
              backgroundColor: canSave ? '#2563eb' : '#d1d5db', 
              color: 'white'
            }}
          >
            승인요청
          </button>
        );
      } else {
        if (currentStatus === 'pending') {
          buttons.push(
            <button 
              key="temp" 
              onClick={() => handleSave('temp')} 
              disabled={!canSave} 
              style={{
                ...buttonStyle, 
                backgroundColor: canSave ? '#6b7280' : '#d1d5db', 
                color: 'white'
              }}
            >
              임시저장
            </button>
          );

          buttons.push(
            <button 
              key="request" 
              onClick={() => handleSave('request')} 
              disabled={!canSave} 
              style={{
                ...buttonStyle, 
                backgroundColor: canSave ? '#2563eb' : '#d1d5db', 
                color: 'white'
              }}
            >
              승인요청
            </button>
          );
        } else if (['approved', 'confirmed'].includes(currentStatus)) {
          // 승인된 스케줄에서는 수정요청만 가능
          buttons.push(
            <button 
              key="modify_request" 
              onClick={() => {
                setRequestType('modify');
                setReasonModalOpen(true);
              }}
              disabled={isDisabled} 
              style={{
                ...buttonStyle, 
                backgroundColor: isDisabled ? '#d1d5db' : '#8b5cf6', 
                color: 'white'
              }}
            >
              수정권한요청
            </button>
          );

          buttons.push(
            <button 
              key="cancel_request" 
              onClick={() => {
                setRequestType('cancel');
                setReasonModalOpen(true);
              }}
              disabled={isDisabled} 
              style={{
                ...buttonStyle, 
                backgroundColor: isDisabled ? '#d1d5db' : '#f59e0b', 
                color: 'white'
              }}
            >
              취소요청
            </button>
          );

          buttons.push(
            <button 
              key="delete_request" 
              onClick={() => {
                setRequestType('delete');
                setReasonModalOpen(true);
              }}
              disabled={isDisabled} 
              style={{
                ...buttonStyle, 
                backgroundColor: isDisabled ? '#d1d5db' : '#dc2626', 
                color: 'white'
              }}
            >
              삭제요청
            </button>
          );
        } else if (isModificationRequested) {
          // 수정요청 대기 중
          buttons.push(
            <button 
              key="cancel_cancel"
              onClick={() => handleSave('cancel_cancel')} 
              disabled={isDisabled} 
              style={{
                ...buttonStyle, 
                backgroundColor: isDisabled ? '#d1d5db' : '#f59e0b', 
                color: 'white'
              }}
            >
              요청철회
            </button>
          );
        } else if (isModificationInProgress) {
          // 수정 권한 부여됨 - 수정 후 승인요청 가능
          buttons.push(
            <button 
              key="temp" 
              onClick={() => handleSave('temp')} 
              disabled={!canSave} 
              style={{
                ...buttonStyle, 
                backgroundColor: canSave ? '#6b7280' : '#d1d5db', 
                color: 'white'
              }}
            >
              임시저장
            </button>
          );

          buttons.push(
            <button 
              key="request"
              onClick={() => handleSave('request')} 
              disabled={!canSave} 
              style={{
                ...buttonStyle, 
                backgroundColor: canSave ? '#2563eb' : '#d1d5db', 
                color: 'white'
              }}
            >
              수정승인요청
            </button>
          );
          
          buttons.push(
            <button 
              key="cancel_request" 
              onClick={() => {
                setRequestType('cancel');
                setReasonModalOpen(true);
              }}
              disabled={isDisabled} 
              style={{
                ...buttonStyle, 
                backgroundColor: isDisabled ? '#d1d5db' : '#f59e0b', 
                color: 'white'
              }}
            >
              취소요청
            </button>
          );
        }

        if (currentStatus === 'cancellation_requested') {
          buttons.push(
            <button 
              key="cancel_cancel"
              onClick={() => handleSave('cancel_cancel')} 
              disabled={isDisabled} 
              style={{
                ...buttonStyle, 
                backgroundColor: isDisabled ? '#d1d5db' : '#f59e0b', 
                color: 'white'
              }}
            >
              요청철회
            </button>
          );
        }

        if (currentStatus === 'deletion_requested') {
          buttons.push(
            <button 
              key="cancel_delete"
              onClick={() => handleSave('cancel_delete')} 
              disabled={isDisabled} 
              style={{
                ...buttonStyle, 
                backgroundColor: isDisabled ? '#d1d5db' : '#f59e0b', 
                color: 'white'
              }}
            >
              요청철회
            </button>
          );
        }
      }
    }

    return buttons;
  };

  if (!open) return null;

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '1200px',        // 🔥 넓은 모달
          maxWidth: '95vw',
          height: '800px',        // 🔥 고정 높이
          maxHeight: '90vh',
          overflow: 'hidden',     // 🔥 스크롤 방지
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 🔥 헤더 (고정) */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <h2 style={{ 
              margin: 0, 
              fontSize: '18px', 
              fontWeight: 'bold',
              color: '#111827'
            }}>
              {isEditMode ? '학원 스케줄 수정' : '학원 스케줄 등록'}
            </h2>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: saving ? 'not-allowed' : 'pointer',
                padding: '0',
                color: '#6b7280',
                opacity: saving ? 0.5 : 1
              }}
            >
              ×
            </button>
          </div>

          {/* 🔥 메인 콘텐츠 영역 (좌우 분할 50:50) */}
          <div style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden'  // 🔥 부모에서 스크롤 방지
          }}>
            
            {/* 🔥 좌측: 스케줄 입력 폼 (50%) */}
            <div style={{
              flex: '0 0 50%',    // 🔥 50% 고정 너비
              padding: '24px',
              overflowY: 'auto',  // 🔥 좌측만 스크롤
              borderRight: '1px solid #E5E7EB'
            }}>
              {/* 🔥 상태 메시지들 */}
              {permissions.roleType === 'manager' && isModificationInProgress && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#fffbeb',
                  color: '#92400e',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: '1px solid #f59e0b'
                }}>
                  🔄 **수정 권한 부여됨** - 관리자가 수정 권한을 부여했습니다. 내용을 수정한 후 '수정승인요청' 버튼을 클릭하세요.
                </div>
              )}

              {permissions.roleType === 'manager' && fieldDisabled && isAfterApproval && !isModificationInProgress && !isInactive && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: '1px solid #fbbf24'
                }}>
                  ⚠️ 승인된 스케줄은 직접 수정할 수 없습니다. '수정권한요청' 버튼을 사용해주세요.
                </div>
              )}

              {permissions.roleType === 'manager' && isModificationRequested && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#f3e8ff',
                  color: '#6b21a8',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: '1px solid #8b5cf6'
                }}>
                  ⏳ 수정요청 대기 중 - 관리자 승인을 기다리고 있습니다.
                </div>
              )}

              {permissions.roleType === 'admin' && currentStatus === 'modification_requested' && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#f3e8ff',
                  color: '#6b21a8',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: '1px solid #8b5cf6'
                }}>
                  📋 **수정 권한 요청됨** - 매니저가 수정 권한을 요청했습니다. '수정권한부여' 버튼으로 승인하세요.
                </div>
              )}

              {isInactive && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: '1px solid #fecaca'
                }}>
                  이 스케줄은 {currentStatus === 'cancelled' ? '취소완료' : '삭제완료'}되었습니다. 수정할 수 없습니다.
                </div>
              )}

              {permissions.roleType === 'admin' && !isInactive && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#f0fdf4',
                  color: '#166534',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: '1px solid #bbf7d0'
                }}>
                  관리자 권한으로 스케줄을 직접 승인, 취소, 삭제할 수 있습니다.
                </div>
              )}

              {userIdLoading && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#eff6ff',
                  color: '#1e40af',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: '1px solid #bfdbfe',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #bfdbfe',
                    borderTop: '2px solid #1e40af',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  사용자 매핑 중...
                </div>
              )}

              {/* 🔥 수정사유 표시 섹션 (기존 로직 유지) */}
              {isEditMode && scheduleData && (
                <div>
                  {scheduleData.modification_reason && isModificationRequested && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#faf5ff',
                      border: '1px solid #8b5cf6',
                      borderRadius: '6px',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#8b5cf6',
                        marginBottom: '4px'
                      }}>
                        📝 수정 요청 사유:
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#374151',
                        lineHeight: 1.4
                      }}>
                        {scheduleData.modification_reason}
                      </div>
                    </div>
                  )}

                  {scheduleData.cancellation_reason && currentStatus === 'cancellation_requested' && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#fffbeb',
                      border: '1px solid #f59e0b',
                      borderRadius: '6px',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#f59e0b',
                        marginBottom: '4px'
                      }}>
                        ❌ 취소 요청 사유:
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#374151',
                        lineHeight: 1.4
                      }}>
                        {scheduleData.cancellation_reason}
                      </div>
                    </div>
                  )}

                  {scheduleData.deletion_reason && currentStatus === 'deletion_requested' && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #dc2626',
                      borderRadius: '6px',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#dc2626',
                        marginBottom: '4px'
                      }}>
                      🗑️ 삭제 요청 사유:
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#374151',
                        lineHeight: 1.4
                      }}>
                        {scheduleData.deletion_reason}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 🔥 폼 필드들 */}
              <div>
                {/* 촬영 날짜 */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    촬영 날짜 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.shoot_date}
                    onChange={(e) => handleChange('shoot_date', e.target.value)}
                    disabled={fieldDisabled}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: fieldDisabled ? '#f9fafb' : 'white'
                    }}
                  />
                </div>

                {/* 시간 정보 */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '16px',
                  marginBottom: '20px' 
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      시작 시간 <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={formData.start_time}
                      onChange={(e) => handleChange('start_time', e.target.value)}
                      disabled={fieldDisabled}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none',
                        backgroundColor: fieldDisabled ? '#f9fafb' : 'white'
                      }}
                    >
                      <option value="">시작 시간 선택</option>
                      {timeOptions.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      종료 시간 <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={formData.end_time}
                      onChange={(e) => handleChange('end_time', e.target.value)}
                      disabled={fieldDisabled}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none',
                        backgroundColor: fieldDisabled ? '#f9fafb' : 'white'
                      }}
                    >
                      <option value="">종료 시간 선택</option>
                      {timeOptions.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 교수명/강의명 */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: '20px' 
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      교수명 <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <ProfessorAutocomplete
                      value={formData.professor_name}
                      onChange={handleProfessorChange}
                      placeholder="교수명을 입력하면 자동완성됩니다"
                      disabled={fieldDisabled}
                      required
                      style={{
                        backgroundColor: fieldDisabled ? '#f9fafb' : 'white'
                      }}
                    />
                    {selectedProfessorInfo && selectedProfessorInfo.category_name && (
                      <p style={{ color: '#059669', fontSize: '12px', margin: '4px 0 0 0' }}>
                        ✓ 매칭됨: {selectedProfessorInfo.category_name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      강의명
                    </label>
                    <input
                      type="text"
                      value={formData.course_name}
                      onChange={(e) => handleChange('course_name', e.target.value)}
                      disabled={fieldDisabled}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none',
                        backgroundColor: fieldDisabled ? '#f9fafb' : 'white'
                      }}
                    />
                  </div>
                </div>

                {/* 강의코드/촬영형식 */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '16px',
                  marginBottom: '20px' 
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      강의코드
                    </label>
                    <input
                      type="text"
                      value={formData.course_code}
                      onChange={(e) => handleChange('course_code', e.target.value)}
                      disabled={fieldDisabled}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none',
                        backgroundColor: fieldDisabled ? '#f9fafb' : 'white'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      촬영형식 <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={formData.shooting_type}
                      onChange={(e) => handleChange('shooting_type', e.target.value)}
                      disabled={fieldDisabled}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none',
                        backgroundColor: fieldDisabled ? '#f9fafb' : 'white'
                      }}
                    >
                      {academyShootingTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 강의실 */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    강의실 <span style={{ color: '#ef4444' }}>*</span>
                    {locationLoading && (
                      <span style={{ color: '#6b7280', fontSize: '12px', marginLeft: '8px' }}>
                        (로딩 중...)
                      </span>
                    )}
                  </label>
                  <select
                    value={formData.sub_location_id}
                    onChange={(e) => handleChange('sub_location_id', e.target.value)}
                    disabled={fieldDisabled || locationLoading}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: (fieldDisabled || locationLoading) ? '#f9fafb' : 'white'
                    }}
                  >
                    {getSafeLocationOptions().map(option => (
                      <option key={option.value} value={option.value} disabled={option.value === 'loading' || option.value === 'no-data'}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 비고 */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    비고
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    disabled={fieldDisabled}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: fieldDisabled ? '#f9fafb' : 'white',
                      resize: 'vertical',
                      minHeight: '60px'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 🔥 우측: 처리 이력 (50%) */}
            <div style={{
              flex: '0 0 50%',    // 🔥 50% 고정 너비
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#f8fafc'
            }}>
              {/* 처리 이력 헤더 */}
              <div style={{
                padding: '20px 24px 16px',
                borderBottom: '1px solid #e5e7eb',
                flexShrink: 0
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#374151'
                }}>
                  처리 이력
                </h3>
              </div>

              {/* 처리 이력 내용 */}
              <div style={{
                flex: 1,
                overflowY: 'auto',  // 🔥 우측만 스크롤
                padding: '16px 24px'
              }}>
                {isEditMode && initialData?.scheduleData?.id ? (
                  <EnhancedScheduleHistory scheduleId={initialData.scheduleData.id} />
                ) : (
                  <div style={{
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: '14px',
                    padding: '40px 20px'
                  }}>
                    스케줄 저장 후 처리 이력이 표시됩니다.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 메시지 표시 */}
          {message && (
            <div style={{
              margin: '0 24px 16px',
              padding: '12px',
              borderRadius: '6px',
              backgroundColor: message.includes('오류') || message.includes('실패') ? '#fef2f2' : '#f0fdf4',
              color: message.includes('오류') || message.includes('실패') ? '#dc2626' : '#166534',
              fontSize: '14px',
              border: `1px solid ${message.includes('오류') || message.includes('실패') ? '#fecaca' : '#bbf7d0'}`,
              flexShrink: 0
            }}>
              {message}
            </div>
          )}

          {/* 🔥 푸터 (버튼 영역, 고정) */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '12px',
            flexShrink: 0,
            backgroundColor: 'white',
            flexWrap: 'wrap'
          }}>
            {(saving || userIdLoading) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginRight: 'auto'
              }}>
                <div style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid #d1d5db',
                  borderTop: '2px solid #059669',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                  {userIdLoading ? '사용자 매핑 중...' : '처리 중...'}
                </span>
              </div>
            )}
            {renderActionButtons()}
          </div>
        </div>
        
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      <ReasonModal
        open={reasonModalOpen}
        type={requestType}
        onClose={() => setReasonModalOpen(false)}
        onSubmit={handleRequestWithReason}
      />
    </>
  );
}
