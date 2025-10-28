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
  onSave: (
    data: any,
    action:
      | 'temp'
      | 'request'
      | 'approve'
      | 'modify_request'
      | 'cancel_request'
      | 'delete_request'
      | 'modify_approve'
      | 'cancel_approve'
      | 'delete_approve'
      | 'cancel'
      | 'delete'
      | 'cancel_cancel'
      | 'cancel_delete'
      | 'approve_modification'
  ) => Promise<{ success: boolean; message: string }>;
}

/* ===============================
   🔥 고도화된 히스토리 컴포넌트
   =============================== */
const EnhancedScheduleHistory = ({ scheduleId }: { scheduleId: number }) => {
  const [scheduleHistory, setScheduleHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchScheduleHistory = async (scheduleId: number) => {
    if (!scheduleId) return;
    setLoadingHistory(true);

    try {
      console.log('📜 학원 스케줄 히스토리 조회 시작:', scheduleId);

      // 1) history
      const { data: historyData, error: historyError } = await supabase
        .from('schedule_history')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('created_at', { ascending: false });
      if (historyError) console.error('히스토리 조회 오류:', historyError);

      // 2) schedule
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();
      if (scheduleError) console.error('스케줄 데이터 조회 오류:', scheduleError);

      // 3) 위치(강의실) 매핑
      const { data: locationData } = await supabase
        .from('sub_locations')
        .select(`id, name, main_locations(id, name)`);
      const locationMap = new Map<number, string>();
      (locationData || []).forEach((loc: any) => {
        locationMap.set(loc.id, `${loc?.main_locations?.name ?? ''} - ${loc?.name ?? ''}`);
      });

      const normalize = (value: any, type: string) => {
        if (value === null || value === undefined || value === '') return '';
        switch (type) {
          case 'time':
            return String(value).substring(0, 5);
          case 'location':
            return String(value);
          case 'text':
            return String(value).trim();
          case 'date':
            return String(value).substring(0, 10);
          default:
            return String(value);
        }
      };

      const parseDetailedChanges = (oldData: any, newData: any) => {
        const changes: Array<{ field: string; oldValue: any; newValue: any; displayName: string }> = [];
        if (!oldData || !newData) {
          return { changes: [], summary: '새로운 스케줄이 생성되었습니다.' };
        }
        const trackFields = [
          { field: 'shoot_date', displayName: '촬영일', type: 'date' },
          { field: 'start_time', displayName: '시작시간', type: 'time' },
          { field: 'end_time', displayName: '종료시간', type: 'time' },
          { field: 'professor_name', displayName: '교수명', type: 'text' },
          { field: 'professor_category_name', displayName: '교수 카테고리', type: 'text' },
          { field: 'course_name', displayName: '강의명', type: 'text' },
          { field: 'course_code', displayName: '강의코드', type: 'text' },
          { field: 'shooting_type', displayName: '촬영형식', type: 'text' },
          { field: 'sub_location_id', displayName: '강의실', type: 'location' },
          { field: 'notes', displayName: '비고', type: 'text' }
        ];

        trackFields.forEach(({ field, displayName, type }) => {
          const ov = normalize(oldData[field], type);
          const nv = normalize(newData[field], type);
          if (ov !== nv && !(ov === '' && nv === '')) {
            let formattedOld = ov || '없음';
            let formattedNew = nv || '없음';
            switch (type) {
              case 'date':
                formattedOld = ov ? new Date(oldData[field]).toLocaleDateString('ko-KR') : '미지정';
                formattedNew = nv ? new Date(newData[field]).toLocaleDateString('ko-KR') : '미지정';
                break;
              case 'time':
                formattedOld = ov || '미지정';
                formattedNew = nv || '미지정';
                break;
              case 'location':
                formattedOld = ov ? locationMap.get(parseInt(ov)) || `강의실 ${ov}` : '미지정';
                formattedNew = nv ? locationMap.get(parseInt(nv)) || `강의실 ${nv}` : '미지정';
                break;
            }
            changes.push({ field, oldValue: formattedOld, newValue: formattedNew, displayName });
          }
        });

        let summary = '';
        if (changes.length === 0) summary = '상태만 변경되었습니다.';
        else if (changes.length === 1) {
          const c = changes[0];
          summary = `${c.displayName}이(가) "${c.oldValue}"에서 "${c.newValue}"(으)로 변경되었습니다.`;
        } else {
          const names = changes.map(c => c.displayName).join(', ');
          summary = `${names} 등 ${changes.length}개 항목이 변경되었습니다.`;
        }
        return { changes, summary };
      };

      const getCurrentUserName = () => {
        const userName = localStorage.getItem('userName') || localStorage.getItem('displayName');
        const userRole = localStorage.getItem('userRole');
        if (userRole === 'system_admin') return userName || '시스템 관리자';
        if (userRole === 'academy_manager') return userName || '학원 매니저';
        return userName || '관리자';
      };

      const getUserDisplayName = async (changedBy: any): Promise<string> => {
        if (!changedBy) return getCurrentUserName();
        if (typeof changedBy === 'string' && isNaN(Number(changedBy))) return changedBy;
        try {
          const { data: userData } = await supabase
            .from('user_profiles')
            .select('name, display_name')
            .eq('id', changedBy)
            .single();
          return (userData?.display_name || userData?.name || getCurrentUserName());
        } catch {
          return getCurrentUserName();
        }
      };

      const currentUserName = getCurrentUserName();
      const historyMap = new Map<string, any>();

      if (scheduleData) {
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

      if (historyData && historyData.length > 0) {
        const unique = historyData.reduce((acc: any[], cur: any) => {
          const t = new Date(cur.created_at).getTime();
          const ex = acc.find(x => Math.abs(new Date(x.created_at).getTime() - t) < 5000 && x.change_type === cur.change_type);
          if (!ex) acc.push(cur);
          return acc;
        }, []);

        for (const item of unique) {
          const key = `history_${item.id}`;
          if (!historyMap.has(key)) {
            let actionName = item.change_type;
            switch (item.change_type) {
              case 'temp': actionName = '임시저장'; break;
              case 'request': actionName = '승인요청'; break;
              case 'approve': actionName = '승인완료'; break;
              case 'modify_request': actionName = '수정요청'; break;
              case 'approve_modification': actionName = '수정권한승인'; break;
              case 'modify_approve': actionName = '수정승인완료'; break;
              case 'cancel_request': actionName = '취소요청'; break;
              case 'cancel_approve': actionName = '취소승인완료'; break;
              case 'delete_request': actionName = '삭제요청'; break;
              case 'delete_approve': actionName = '삭제승인완료'; break;
              case 'cancel_cancel': actionName = '요청철회'; break;
              case 'cancel_delete': actionName = '삭제요청철회'; break;
              case 'cancel': actionName = '직접취소'; break;
              case 'delete': actionName = '직접삭제'; break;
            }

            const changedByName = await getUserDisplayName(item.changed_by);
            let detailsText = item.description || '';
            let changesList: any[] = [];
            try {
              const oldDataParsed = item.old_value ? JSON.parse(item.old_value) : null;
              const newDataParsed = item.new_value ? JSON.parse(item.new_value) : null;
              if (oldDataParsed && newDataParsed) {
                const { changes, summary } = parseDetailedChanges(oldDataParsed, newDataParsed);
                changesList = changes;
                if (changes.length > 0) detailsText = `${detailsText} - ${summary}`;
              }
            } catch (e) {
              console.warn('히스토리 데이터 파싱 오류:', e);
            }

            historyMap.set(key, {
              id: key,
              action: actionName,
              reason: item.description || '',
              changed_by: changedByName,
              created_at: item.created_at,
              details: detailsText,
              changes: changesList,
              source: 'history'
            });
          }
        }
      }

      const all = Array.from(historyMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setScheduleHistory(all);
      console.log('✅ 학원 히스토리 조회 완료:', all.length, '개');
    } catch (e) {
      console.error('학원 히스토리 조회 오류:', e);
      setScheduleHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (scheduleId) fetchScheduleHistory(scheduleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  const historyItemStyle = (action: string) => {
    switch (action) {
      case "취소완료":
      case "취소승인완료":
      case "직접취소":
        return { backgroundColor: "#fef2f2", borderColor: "#fecaca", padding: 12, marginBottom: 8, border: "1px solid #fecaca", borderRadius: 6 };
      case "수정요청":
      case "수정권한승인":
      case "수정승인완료":
        return { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0", padding: 12, marginBottom: 8, border: "1px solid #bbf7d0", borderRadius: 6 };
      case "승인완료":
      case "승인요청":
        return { backgroundColor: "#eff6ff", borderColor: "#dbeafe", padding: 12, marginBottom: 8, border: "1px solid #dbeafe", borderRadius: 6 };
      case "등록됨":
        return { backgroundColor: "#fefce8", borderColor: "#fde047", padding: 12, marginBottom: 8, border: "1px solid #fde047", borderRadius: 6 };
      default:
        return { backgroundColor: "#f9fafb", borderColor: "#e5e7eb", padding: 12, marginBottom: 8, border: "1px solid #e5e7eb", borderRadius: 6 };
    }
  };

  if (!scheduleId) return null;

  return (
    <div>
      {loadingHistory ? (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: 20, fontSize: 14 }}>히스토리를 불러오는 중...</div>
      ) : scheduleHistory.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: 20, fontSize: 14 }}>변경 이력이 없습니다.</div>
      ) : (
        <div style={{ maxHeight: '100%', overflowY: 'auto' }}>
          {scheduleHistory.map(item => (
            <div key={item.id} style={historyItemStyle(item.action)}>
              <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', fontSize: 14 }}>{item.action}</p>
              <p style={{ margin: '0 0 4px 0', fontSize: 12, color: '#6b7280' }}>{new Date(item.created_at).toLocaleString()}</p>
              <p style={{ margin: '0 0 6px 0', fontSize: 12 }}>처리자: {item.changed_by}</p>

              {item.changes && item.changes.length > 0 && (
                <div style={{ marginBottom: 8, padding: 8, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 4, fontSize: 12 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#374151' }}>📝 변경 내용:</div>
                  {item.changes.map((change: any, idx: number) => (
                    <div key={idx} style={{ marginBottom: 2, color: '#4b5563', lineHeight: 1.4 }}>
                      • <strong>{change.displayName}:</strong> {change.oldValue} → {change.newValue}
                    </div>
                  ))}
                </div>
              )}

              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4 }}>{item.details}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ======================
   🔥 사유 입력 모달
   ====================== */
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

  const titles = { modify: '수정 요청 사유', cancel: '취소 요청 사유', delete: '삭제 요청 사유' };
  const placeholders = { modify: '수정이 필요한 이유를 입력해주세요...', cancel: '취소가 필요한 이유를 입력해주세요...', delete: '삭제가 필요한 이유를 입력해주세요...' };
  if (!open) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ backgroundColor: 'white', borderRadius: 12, width: 400, maxWidth: '90vw', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 'bold' }}>{titles[type]}</h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholders[type]}
          rows={4}
          style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', resize: 'vertical', marginBottom: 16 }}
        />
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, backgroundColor: 'white', cursor: 'pointer' }}>취소</button>
          <button
            onClick={() => {
              if (!reason.trim()) {
                alert('사유를 입력해주세요.');
                return;
              }
              onSubmit(reason.trim());
              setReason('');
            }}
            style={{ padding: '8px 16px', border: 'none', borderRadius: 6, backgroundColor: '#2563eb', color: 'white', cursor: 'pointer' }}
          >
            요청 전송
          </button>
        </div>
      </div>
    </div>
  );
};

/* ==============================
   🔥 메인: AcademyScheduleModal
   ============================== */
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

  const [availableLocations, setAvailableLocations] = useState<any[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);

  // 🔥 사용자 ID 조회
  useEffect(() => {
    const getCurrentUserId = async () => {
      if (!open) return;
      try {
        setUserIdLoading(true);
        console.log('🔍 사용자 ID 조회 시작...');

        const storedUserName = localStorage.getItem('userName');
        const storedUserRole = localStorage.getItem('userRole');
        console.log('📦 localStorage 정보:', { userName: storedUserName, userRole: storedUserRole });

        const userMapping: Record<string, number> = {
          system_admin: 1,
          schedule_admin: 2,
          academy_manager: 3,
          studio_manager: 4,
          테스트관리자: 1,
          테스트매니저: 3,
          manager1: 1
        };
        let mappedUserId: number | null = null;

        if (storedUserName && userMapping[storedUserName]) mappedUserId = userMapping[storedUserName];
        else if (storedUserRole && userMapping[storedUserRole]) mappedUserId = userMapping[storedUserRole];

        if (mappedUserId) {
          setCurrentUserId(mappedUserId);
          setUserIdLoading(false);
          return;
        }

        const storedUserId = localStorage.getItem('userId');
        if (storedUserId && storedUserId !== 'null' && storedUserId !== 'undefined') {
          const parsed = parseInt(storedUserId);
          if (!isNaN(parsed) && parsed > 0) {
            console.log('✅ localStorage에서 사용자 ID 획득:', parsed);
            setCurrentUserId(parsed);
            setUserIdLoading(false);
            return;
          }
        }

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('id, name, email')
              .eq('auth_user_id', user.id)
              .single();
            if (profile?.id) {
              localStorage.setItem('userId', profile.id.toString());
              setCurrentUserId(profile.id);
              setUserIdLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn('⚠️ Supabase 인증 실패(무시 가능):', e);
        }

        setCurrentUserId(1);
      } catch (e) {
        console.error('❌ 사용자 ID 조회 실패:', e);
        setCurrentUserId(1);
      } finally {
        setUserIdLoading(false);
      }
    };

    getCurrentUserId();
  }, [open]);

  // 🔥 강의실 로딩
  useEffect(() => {
    const fetchLocationData = async () => {
      if (!open) return;
      try {
        setLocationLoading(true);
        let query = supabase
          .from('sub_locations')
          .select(`*, main_locations!inner(*)`)
          .eq('is_active', true)
          .eq('main_locations.location_type', 'academy')
          .order('main_location_id')
          .order('id');

        const role = localStorage.getItem('userRole') || '';
        if (role === 'academy_manager') {
          const assignedAcademyIds = JSON.parse(localStorage.getItem('assignedAcademyIds') || '[]');
          if (assignedAcademyIds.length > 0) query = query.in('main_location_id', assignedAcademyIds);
        }

        const { data } = await query;
        const formatted = (data || []).map((loc: any) => ({
          ...loc,
          displayName: `${loc.main_locations?.name ?? ''} - ${loc.name}`,
          fullName: `${loc.main_locations?.name ?? ''} - ${loc.name}`
        }));
        setAvailableLocations(formatted);
      } catch (e) {
        console.error('❌ 강의실 데이터 로딩 실패:', e);
        setAvailableLocations([]);
      } finally {
        setLocationLoading(false);
      }
    };
    fetchLocationData();
  }, [open]);

  // 🔥 초기 폼 데이터
  const getInitValue = (v: any): string => (v === null || v === undefined ? '' : String(v).trim());
  const formatTimeForInput = (t: any): string => {
    if (!t) return '';
    const s = String(t).trim();
    if (s.includes(':')) {
      const [h, m] = s.split(':');
      return `${h.padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}`;
    }
    return s;
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
        sub_location_id: getInitValue(scheduleData.sub_location_id || initialData.locationId),
        // ✅ 추가: 저장값 복원용
        professor_category_name: getInitValue(scheduleData.professor_category_name),
        professor_category_id: scheduleData.professor_category_id ?? null
      };
    }
    return {
      shoot_date: getInitValue(initialData?.date),
      start_time: '',
      end_time: '',
      professor_name: '',
      course_name: '',
      course_code: '',
      shooting_type: '촬영',
      notes: '',
      sub_location_id: getInitValue(initialData?.locationId),
      // ✅ 추가: 신규 기본값
      professor_category_name: '',
      professor_category_id: null
    };
  };

  const [formData, setFormData] = useState(getInitialFormData);
  const [selectedProfessorInfo, setSelectedProfessorInfo] = useState<any>(null);

  // 🔥 교수 자동완성 변경 핸들러
  const handleProfessorChange = (value: string, professor?: any) => {
    setFormData(prev => ({
      ...prev,
      professor_name: value,
      professor_category_name: professor?.category_name ?? prev.professor_category_name ?? '',
      professor_category_id:
        (professor?.category_id ?? professor?.categoryId ?? professor?.id) ??
        prev.professor_category_id ??
        null
    }));

    if (professor) {
      setSelectedProfessorInfo({
        id: professor?.id ?? professor?.category_id ?? professor?.categoryId ?? null,
        category_name: professor?.category_name ?? ''
      });
    } else {
      setSelectedProfessorInfo(null);
    }
  };

  // 🔥 모달 열릴 때 저장된 매칭 배지 복원
  useEffect(() => {
    if (!open) return;
    const sd = initialData?.scheduleData;
    if (sd?.professor_category_name) {
      setSelectedProfessorInfo({
        id: sd.professor_category_id ?? null,
        category_name: sd.professor_category_name
      });
    } else if (!formData.professor_category_name) {
      setSelectedProfessorInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData?.scheduleData?.id]);

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
    // 기존 저장값에 따라 배지 복원은 위 useEffect에서 처리
    console.log('🔧 모달 데이터 변경됨 - 폼 데이터 업데이트:', {
      currentStatus: initialData?.scheduleData?.approval_status,
      newFormData
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.scheduleData?.approval_status]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open && !saving) onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, saving, onClose]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 🔥 권한
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
  const scheduleData = initialData?.scheduleData || null;
  const currentStatus = scheduleData?.approval_status || 'pending';
  const isInactive = scheduleData?.is_active === false;

  const isAfterApproval = ['approved', 'confirmed'].includes(currentStatus);
  const isAfterApprovalRequest = ['approval_requested', 'approved', 'confirmed'].includes(currentStatus);
  const isModificationInProgress = currentStatus === 'modification_approved';
  const isModificationRequested = currentStatus === 'modification_requested';
  const isCancellationInProgress = currentStatus === 'cancellation_requested';
  const isDeletionInProgress = currentStatus === 'deletion_requested';

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
    const skip = [
      'modify_request', 'cancel_request', 'delete_request',
      'cancel_approve', 'delete_approve', 'cancel', 'delete',
      'cancel_cancel', 'cancel_delete'
    ];
    if (skip.includes(action)) return [];
    const required = [
      { field: 'shoot_date', label: '촬영 날짜' },
      { field: 'start_time', label: '시작 시간' },
      { field: 'end_time', label: '종료 시간' },
      { field: 'professor_name', label: '교수명' },
      { field: 'shooting_type', label: '촬영형식' },
      { field: 'sub_location_id', label: '강의실' }
    ];
    return required.filter(f =>
      !formData[f.field as keyof typeof formData] ||
      String(formData[f.field as keyof typeof formData]).trim() === '' ||
      String(formData[f.field as keyof typeof formData]) === '0'
    );
  };

  // 🔥 저장
  const handleSave = async (action: string, reason?: string) => {
    if (userIdLoading) {
      setMessage('사용자 정보를 확인하는 중입니다. 잠시만 기다려주세요.');
      return;
    }
    if (!currentUserId) {
      setMessage('사용자 정보를 확인할 수 없습니다. 새로고침 후 다시 시도해주세요.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const emptyFields = validateFieldsForAction(action);
      if (emptyFields.length > 0) {
        const names = emptyFields.map(f => f.label).join(', ');
        throw new Error(`다음 필수 필드를 입력해주세요: ${names}`);
      }

      const formDataWithUser = {
        ...formData,
        currentUserId: currentUserId,
        reason: reason || '',
        // ✅ 수정됨: 편집 모드면 id 포함해 업데이트로 처리되게 함
        schedule_id: initialData?.scheduleData?.id || null,
        // ✅ 선택된 교수 카테고리(자동완성에서 받은 값)가 있으면 함께 저장
        professor_category_name: selectedProfessorInfo?.category_name || null,
        professor_category_id: selectedProfessorInfo?.id || null,
      };

      console.log('💾 저장 시도:', { action, currentUserId, formDataWithUser });
      const result = await onSave(formDataWithUser, action as any);
      setMessage(result.message);

      if (result.success) {
        alert(result.message);
        onClose();
        setMessage('');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '처리 중 오류가 발생했습니다.';
      setMessage(msg);
      alert(msg);
      console.error('저장 오류:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestWithReason = (reason: string) => {
    setReasonModalOpen(false);
    const map = { modify: 'modify_request', cancel: 'cancel_request', delete: 'delete_request' } as const;
    handleSave(map[requestType], reason);
  };

  const generateTimeOptions = () => {
    const options: string[] = [];
    for (let h = 7; h <= 22; h++) {
      for (let m = 0; m < 60; m += 5) {
        options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return options;
  };
  const timeOptions = generateTimeOptions();
  const academyShootingTypes = ['촬영', '중계', '(본사)촬영', '라이브촬영', '라이브중계', '(NAS)촬영'];

  const getSafeLocationOptions = () => {
    const base = [{ value: '', label: '강의실 선택' }];
    if (locationLoading) return [...base, { value: 'loading', label: '강의실 정보 로딩 중...' }];
    if (!availableLocations || availableLocations.length === 0) return [...base, { value: 'no-data', label: '강의실 정보 없음 (관리자 문의)' }];
    const locs = availableLocations.map((l: any) => ({ value: String(l.id), label: l.displayName || l.fullName || l.name || `강의실 ${l.id}` }));
    return [...base, ...locs];
  };

  const getFieldDisabled = () => {
    if (saving || userIdLoading || isInactive) return true;
    if (permissions.roleType === 'admin') return false;
    if (permissions.roleType === 'manager') {
      if (isModificationInProgress) return false;
      if (isModificationRequested) return true;
      if (isAfterApproval) return true;
      if (isAfterApprovalRequest && currentStatus !== 'pending') return true;
      return false;
    }
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

  const renderActionButtons = () => {
    const emptyForTemp = validateFieldsForAction('temp');
    const canSave = !saving && !userIdLoading && emptyForTemp.length === 0 && !isInactive && currentUserId;

    const BTN = { padding: '10px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500 } as const;
    const buttons: React.ReactNode[] = [];

    buttons.push(
      <button key="close" onClick={onClose} disabled={saving}
        style={{ ...BTN, border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1 }}>
        닫기
      </button>
    );
    if (isInactive) return buttons;

    const isDisabled = saving || userIdLoading || !currentUserId;

    if (permissions.roleType === 'admin') {
      buttons.push(
        <button key="temp" onClick={() => handleSave('temp')} disabled={!canSave}
          style={{ ...BTN, backgroundColor: canSave ? '#6b7280' : '#d1d5db', color: 'white' }}>
          임시저장
        </button>
      );

      if (!isEditMode) {
        buttons.push(
          <button key="approve" onClick={() => handleSave('approve')} disabled={!canSave}
            style={{ ...BTN, backgroundColor: canSave ? '#059669' : '#d1d5db', color: 'white' }}>
            승인
          </button>
        );
      } else {
        buttons.push(
          <button key="modify_approve" onClick={() => handleSave('modify_approve')} disabled={!canSave}
            style={{ ...BTN, backgroundColor: canSave ? '#059669' : '#d1d5db', color: 'white' }}>
            승인
          </button>
        );

        if (currentStatus === 'modification_requested') {
          buttons.push(
            <button key="approve_modification" onClick={() => handleSave('approve_modification')} disabled={isDisabled}
              style={{ ...BTN, backgroundColor: isDisabled ? '#d1d5db' : '#8b5cf6', color: 'white' }}>
              수정권한부여
            </button>
          );
        }

        if (currentStatus === 'cancellation_requested') {
          buttons.push(
            <button key="cancel_approve" onClick={() => handleSave('cancel_approve')} disabled={isDisabled}
              style={{ ...BTN, backgroundColor: isDisabled ? '#d1d5db' : '#f59e0b', color: 'white' }}>
              취소승인
            </button>
          );
          buttons.push(
            <button key="cancel_cancel" onClick={() => handleSave('cancel_cancel')} disabled={isDisabled}
              style={{ ...BTN, backgroundColor: isDisabled ? '#d1d5db' : '#6b7280', color: 'white' }}>
              취소거부
            </button>
          );
        }

        if (currentStatus === 'deletion_requested') {
          buttons.push(
            <button key="delete_approve" onClick={() => handleSave('delete_approve')} disabled={isDisabled}
              style={{ ...BTN, backgroundColor: isDisabled ? '#d1d5db' : '#dc2626', color: 'white' }}>
              삭제승인
            </button>
          );
          buttons.push(
            <button key="cancel_delete" onClick={() => handleSave('cancel_delete')} disabled={isDisabled}
              style={{ ...BTN, backgroundColor: isDisabled ? '#d1d5db' : '#6b7280', color: 'white' }}>
              삭제거부
            </button>
          );
        }

        buttons.push(
          <button key="cancel" onClick={() => handleSave('cancel')} disabled={isDisabled}
            style={{ ...BTN, backgroundColor: isDisabled ? '#d1d5db' : '#f59e0b', color: 'white' }}>
            취소
          </button>
        );
        buttons.push(
          <button key="delete" onClick={() => handleSave('delete')} disabled={isDisabled}
            style={{ ...BTN, backgroundColor: isDisabled ? '#d1d5db' : '#dc2626', color: 'white' }}>
            삭제
          </button>
        );
      }
    } else if (permissions.roleType === 'manager') {
      if (!isEditMode) {
        buttons.push(
          <button key="temp" onClick={() => handleSave('temp')} disabled={!canSave}
            style={{ ...BTN, backgroundColor: canSave ? '#6b7280' : '#d1d5db', color: 'white' }}>
            임시저장
          </button>
        );
        buttons.push(
          <button key="request" onClick={() => handleSave('request')} disabled={!canSave}
            style={{ ...BTN, backgroundColor: canSave ? '#2563eb' : '#d1d5db', color: 'white' }}>
            승인요청
          </button>
        );
      } else {
        if (currentStatus === 'pending') {
          buttons.push(
            <button key="temp" onClick={() => handleSave('temp')} disabled={!canSave}
              style={{ ...BTN, backgroundColor: canSave ? '#6b7280' : '#d1d5db', color: 'white' }}>
              임시저장
            </button>
          );
          buttons.push(
            <button key="request" onClick={() => handleSave('request')} disabled={!canSave}
              style={{ ...BTN, backgroundColor: canSave ? '#2563eb' : '#d1d5db', color: 'white' }}>
              승인요청
            </button>
          );
        } else if (['approved', 'confirmed'].includes(currentStatus)) {
          buttons.push(
            <button key="modify_request" onClick={() => { setRequestType('modify'); setReasonModalOpen(true); }} disabled={isDisabled}
              style={{ ...BTN, backgroundColor: isDisabled ? '#d1d5db' : '#8b5cf6', color: 'white' }}>
              수정권한요청
            </button>
          );
          buttons.push(
            <button key="cancel_request" onClick={() => { setRequestType('cancel'); setReasonModalOpen(true); }} disabled={isDisabled}
              style={{ ...BTN, backgroundColor: isDisabled ? '#d1d5db' : '#f59e0b', color: 'white' }}>
              취소요청
            </button>
          );
          buttons.push(
            <button key="delete_request" onClick={() => { setRequestType('delete'); setReasonModalOpen(true); }} disabled={isDisabled}
              style={{ ...BTN, backgroundColor: isDisabled ? '#d1d5db' : '#dc2626', color: 'white' }}>
              삭제요청
            </button>
          );
        } else if (isModificationRequested) {
          buttons.push(
            <button key="cancel_cancel" onClick={() => handleSave('cancel_cancel')} disabled={isDisabled}
              style={{ ...BTN, backgroundColor: isDisabled ? '#d1d5db' : '#f59e0b', color: 'white' }}>
              요청철회
            </button>
          );
        } else if (isModificationInProgress) {
          buttons.push(
            <button key="temp" onClick={() => handleSave('temp')} disabled={!canSave}
              style={{ ...BTN, backgroundColor: canSave ? '#6b7280' : '#d1d5db', color: 'white' }}>
              임시저장
            </button>
          );
          buttons.push(
            <button key="request" onClick={() => handleSave('request')} disabled={!canSave}
              style={{ ...BTN, backgroundColor: canSave ? '#2563eb' : '#d1d5db', color: 'white' }}>
              수정승인요청
            </button>
          );
          buttons.push(
            <button key="cancel_request" onClick={() => { setRequestType('cancel'); setReasonModalOpen(true); }} disabled={isDisabled}
              style={{ ...BTN, backgroundColor: isDisabled ? '#d1d5db' : '#f59e0b', color: 'white' }}>
              취소요청
            </button>
          );
        }

        if (currentStatus === 'cancellation_requested') {
          buttons.push(
            <button key="cancel_cancel" onClick={() => handleSave('cancel_cancel')} disabled={isDisabled}
              style={{ ...BTN, backgroundColor: isDisabled ? '#d1d5db' : '#f59e0b', color: 'white' }}>
              요청철회
            </button>
          );
        }
        if (currentStatus === 'deletion_requested') {
          buttons.push(
            <button key="cancel_delete" onClick={() => handleSave('cancel_delete')} disabled={isDisabled}
              style={{ ...BTN, backgroundColor: isDisabled ? '#d1d5db' : '#f59e0b', color: 'white' }}>
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
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ backgroundColor: 'white', borderRadius: 12, width: 1200, maxWidth: '95vw', height: 800, maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
          {/* 헤더 */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 'bold', color: '#111827' }}>{isEditMode ? '학원 스케줄 수정' : '학원 스케줄 등록'}</h2>
            <button onClick={onClose} disabled={saving} style={{ background: 'none', border: 'none', fontSize: 24, cursor: saving ? 'not-allowed' : 'pointer', padding: 0, color: '#6b7280', opacity: saving ? 0.5 : 1 }}>
              ×
            </button>
          </div>

          {/* 본문 */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* 좌측 폼 */}
            <div style={{ flex: '0 0 50%', padding: 24, overflowY: 'auto', borderRight: '1px solid #E5E7EB' }}>
              {/* 안내/상태 배너들 */}
              {permissions.roleType === 'manager' && isModificationInProgress && (
                <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#fffbeb', color: '#92400e', fontSize: 14, borderRadius: 6, border: '1px solid #f59e0b' }}>
                  🔄 <strong>수정 권한 부여됨</strong> - 내용을 수정한 후 <strong>수정승인요청</strong>을 클릭하세요.
                </div>
              )}
              {permissions.roleType === 'manager' && fieldDisabled && isAfterApproval && !isModificationInProgress && !isInactive && (
                <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#fef3c7', color: '#92400e', fontSize: 14, borderRadius: 6, border: '1px solid #fbbf24' }}>
                  ⚠️ 승인된 스케줄은 직접 수정할 수 없습니다. <strong>수정권한요청</strong>을 사용해주세요.
                </div>
              )}
              {permissions.roleType === 'manager' && isModificationRequested && (
                <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f3e8ff', color: '#6b21a8', fontSize: 14, borderRadius: 6, border: '1px solid #8b5cf6' }}>
                  ⏳ 수정요청 대기 중 - 관리자 승인을 기다리고 있습니다.
                </div>
              )}
              {permissions.roleType === 'admin' && currentStatus === 'modification_requested' && (
                <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f3e8ff', color: '#6b21a8', fontSize: 14, borderRadius: 6, border: '1px solid #8b5cf6' }}>
                  📋 <strong>수정 권한 요청됨</strong> - 매니저가 수정 권한을 요청했습니다.
                </div>
              )}
              {isInactive && (
                <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#fef2f2', color: '#dc2626', fontSize: 14, borderRadius: 6, border: '1px solid #fecaca' }}>
                  이 스케줄은 {currentStatus === 'cancelled' ? '취소완료' : '삭제완료'}되었습니다. 수정할 수 없습니다.
                </div>
              )}
              {permissions.roleType === 'admin' && !isInactive && (
                <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f0fdf4', color: '#166534', fontSize: 14, borderRadius: 6, border: '1px solid #bbf7d0' }}>
                  관리자 권한으로 스케줄을 직접 승인/취소/삭제할 수 있습니다.
                </div>
              )}
              {userIdLoading && (
                <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#eff6ff', color: '#1e40af', fontSize: 14, borderRadius: 6, border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 16, height: 16, border: '2px solid #bfdbfe', borderTop: '2px solid #1e40af', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  사용자 매핑 중...
                </div>
              )}

              {/* 수정 사유(상태별) */}
              {isEditMode && scheduleData && (
                <div>
                  {scheduleData.modification_reason && isModificationRequested && (
                    <div style={{ padding: 12, backgroundColor: '#faf5ff', border: '1px solid #8b5cf6', borderRadius: 6, marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#8b5cf6', marginBottom: 4 }}>📝 수정 요청 사유:</div>
                      <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.4 }}>{scheduleData.modification_reason}</div>
                    </div>
                  )}
                  {scheduleData.cancellation_reason && isCancellationInProgress && (
                    <div style={{ padding: 12, backgroundColor: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 6, marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#f59e0b', marginBottom: 4 }}>❌ 취소 요청 사유:</div>
                      <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.4 }}>{scheduleData.cancellation_reason}</div>
                    </div>
                  )}
                  {scheduleData.deletion_reason && isDeletionInProgress && (
                    <div style={{ padding: 12, backgroundColor: '#fef2f2', border: '1px solid #dc2626', borderRadius: 6, marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#dc2626', marginBottom: 4 }}>🗑️ 삭제 요청 사유:</div>
                      <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.4 }}>{scheduleData.deletion_reason}</div>
                    </div>
                  )}
                </div>
              )}

              {/* 폼 */}
              <div>
                {/* 날짜 */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                    촬영 날짜 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.shoot_date}
                    onChange={(e) => handleChange('shoot_date', e.target.value)}
                    disabled={fieldDisabled}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', backgroundColor: fieldDisabled ? '#f9fafb' : 'white' }}
                  />
                </div>

                {/* 시간 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                      시작 시간 <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={formData.start_time}
                      onChange={(e) => handleChange('start_time', e.target.value)}
                      disabled={fieldDisabled}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', backgroundColor: fieldDisabled ? '#f9fafb' : 'white' }}
                    >
                      <option value="">시작 시간 선택</option>
                      {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                      종료 시간 <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={formData.end_time}
                      onChange={(e) => handleChange('end_time', e.target.value)}
                      disabled={fieldDisabled}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', backgroundColor: fieldDisabled ? '#f9fafb' : 'white' }}
                    >
                      <option value="">종료 시간 선택</option>
                      {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* 교수 / 강의명 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                      교수명 <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <ProfessorAutocomplete
                      value={formData.professor_name}
                      onChange={handleProfessorChange}
                      placeholder="교수명을 입력하면 자동완성됩니다"
                      disabled={fieldDisabled}
                      required
                      style={{ backgroundColor: fieldDisabled ? '#f9fafb' : 'white' }}
                    />
                    {(selectedProfessorInfo?.category_name || formData.professor_category_name) && (
                      <p style={{ color: '#059669', fontSize: 12, margin: '6px 0 0 0' }}>
                        ✓ 매칭됨: {selectedProfessorInfo?.category_name || formData.professor_category_name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                      강의명
                    </label>
                    <input
                      type="text"
                      value={formData.course_name}
                      onChange={(e) => handleChange('course_name', e.target.value)}
                      disabled={fieldDisabled}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', backgroundColor: fieldDisabled ? '#f9fafb' : 'white' }}
                    />
                  </div>
                </div>

                {/* 강의코드 / 촬영형식 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                      강의코드
                    </label>
                    <input
                      type="text"
                      value={formData.course_code}
                      onChange={(e) => handleChange('course_code', e.target.value)}
                      disabled={fieldDisabled}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', backgroundColor: fieldDisabled ? '#f9fafb' : 'white' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                      촬영형식 <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={formData.shooting_type}
                      onChange={(e) => handleChange('shooting_type', e.target.value)}
                      disabled={fieldDisabled}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', backgroundColor: fieldDisabled ? '#f9fafb' : 'white' }}
                    >
                      {academyShootingTypes.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                </div>

                {/* 강의실 */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                    강의실 <span style={{ color: '#ef4444' }}>*</span>
                    {locationLoading && <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 8 }}>(로딩 중...)</span>}
                  </label>
                  <select
                    value={formData.sub_location_id}
                    onChange={(e) => handleChange('sub_location_id', e.target.value)}
                    disabled={fieldDisabled || locationLoading}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', backgroundColor: (fieldDisabled || locationLoading) ? '#f9fafb' : 'white' }}
                  >
                    {getSafeLocationOptions().map(opt => (
                      <option key={opt.value} value={opt.value} disabled={opt.value === 'loading' || opt.value === 'no-data'}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 비고 */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#374151' }}>비고</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    disabled={fieldDisabled}
                    rows={3}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', backgroundColor: fieldDisabled ? '#f9fafb' : 'white', resize: 'vertical', minHeight: 60 }}
                  />
                </div>
              </div>
            </div>

            {/* 우측 이력 */}
            <div style={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 'bold', color: '#374151' }}>처리 이력</h3>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {isEditMode && initialData?.scheduleData?.id ? (
                  <EnhancedScheduleHistory scheduleId={initialData.scheduleData.id} />
                ) : (
                  <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 14, padding: '40px 20px' }}>
                    스케줄 저장 후 처리 이력이 표시됩니다.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 메시지 */}
          {message && (
            <div style={{
              margin: '0 24px 16px',
              padding: 12,
              borderRadius: 6,
              backgroundColor: message.includes('오류') || message.includes('실패') ? '#fef2f2' : '#f0fdf4',
              color: message.includes('오류') || message.includes('실패') ? '#dc2626' : '#166534',
              fontSize: 14,
              border: `1px solid ${message.includes('오류') || message.includes('실패') ? '#fecaca' : '#bbf7d0'}`,
              flexShrink: 0
            }}>
              {message}
            </div>
          )}

          {/* 푸터 버튼 */}
          <div style={{ padding: 16, borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, flexShrink: 0, backgroundColor: 'white', flexWrap: 'wrap' }}>
            {(saving || userIdLoading) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto' }}>
                <div style={{ width: 14, height: 14, border: '2px solid #d1d5db', borderTop: '2px solid #059669', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 14, color: '#6b7280' }}>{userIdLoading ? '사용자 매핑 중...' : '처리 중...'}</span>
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
