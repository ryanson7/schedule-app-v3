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

  // 🔥 스튜디오 모달과 동일한 히스토리 상태
  const [scheduleHistory, setScheduleHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);


  // 🔥 시간 포맷 (히스토리용)
  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


const fetchScheduleHistory = async (scheduleId: number) => {
  if (!scheduleId) return;

  setHistoryLoading(true);
  
  try {
    console.log('학원 히스토리 조회 시작:', scheduleId);

    const { data: historyData, error: historyError } = await supabase
      .from('schedule_history')
      .select('*')
      .eq('schedule_id', scheduleId)
      .order('created_at', { ascending: false });

    if (historyError) {
      console.error('히스토리 조회 오류:', historyError);
    }

    const { data: scheduleData, error: scheduleError } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (scheduleError) {
      console.error('스케줄 데이터 조회 오류:', scheduleError);
    }

    // 🔥 1. 모든 changed_by ID 수집
    const allUserIds = new Set<number>();
    
    if (historyData) {
      historyData.forEach(h => {
        if (typeof h.changed_by === 'number') {
          allUserIds.add(h.changed_by);
        }
      });
    }

    // 🔥 2. users 테이블에서 한 번에 조회
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', Array.from(allUserIds));

    const userMap = new Map(users?.map(u => [u.id, u.name]) || []);
    
    console.log('👥 사용자 매핑:', userMap);

    // 🔥 3. getUserDisplayName 함수
    const getUserDisplayName = (changedBy: any): string => {
      if (!changedBy) return '담당자 정보 없음';
      
      if (typeof changedBy === 'number') {
        return userMap.get(changedBy) || `ID: ${changedBy}`;
      }
      
      if (typeof changedBy === 'string' && !isNaN(Number(changedBy))) {
        const userId = Number(changedBy);
        return userMap.get(userId) || `ID: ${changedBy}`;
      }
      
      return changedBy;
    };

    const historyMap = new Map<string, any>();

    // 시스템 히스토리 추가 (등록됨)
    if (scheduleData) {
      const createdHistory = historyData?.find(h => h.change_type === 'created');
      
      if (createdHistory) {
        const creatorName = getUserDisplayName(createdHistory.changed_by);

        historyMap.set(`created_${scheduleData.id}`, {
          id: `created_${scheduleData.id}`,
          action: '등록됨',
          reason: '최초 스케줄 등록',
          changed_by: creatorName,
          created_at: scheduleData.created_at,
          details: `${scheduleData.professor_name} 교수님 스케줄 등록`,
          source: 'system'
        });
      }
    }

    // schedule_history 데이터 병합
    if (historyData && historyData.length > 0) {
      historyData.forEach(item => {
        const userName = getUserDisplayName(item.changed_by);

        historyMap.set(item.id.toString(), {
          id: item.id.toString(),
          action: item.change_type === 'approved' || item.change_type === 'approve' ? '승인완료' :
                  item.change_type === 'cancelled' ? '취소완료' :
                  item.change_type.toLowerCase() === 'update' ? '수정됨' :
                  item.change_type === 'created' ? '등록됨' : '처리됨',
          reason: item.description || '-',
          changed_by: userName,
          created_at: item.created_at,
          details: item.description || '',
          source: 'history'
        });
      });
    }

    const essentialHistory = Array.from(historyMap.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setScheduleHistory(essentialHistory);
    console.log('학원 히스토리 조회 완료:', essentialHistory.length, '개');

  } catch (error) {
    console.error('히스토리 조회 오류:', error);
    setScheduleHistory([]);
  } finally {
    setHistoryLoading(false);
  }
};

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
    const isEditModeLocal = !!(scheduleData && scheduleData.id);
    if (isEditModeLocal) {
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
      setScheduleHistory([]);
    }
  }, [open]);

  useEffect(() => {
    const newFormData = getInitialFormData();
    setFormData(newFormData);
    console.log('🔧 모달 데이터 변경됨 - 폼 데이터 업데이트:', {
      currentStatus: initialData?.scheduleData?.approval_status,
      newFormData
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.scheduleData?.approval_status]);

  // 🔥 히스토리 로딩 트리거 (스튜디오와 동일 패턴)
  const isEditMode = !!(initialData?.scheduleData && initialData.scheduleData.id);
  useEffect(() => {
  if (isEditMode && initialData?.scheduleData?.id && open) {
    fetchScheduleHistory(initialData.scheduleData.id);
  } else {
    setScheduleHistory([]);
  }
}, [isEditMode, initialData?.scheduleData?.id, open]);


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

    // ✅ 현재 로그인한 담당자 이름
    const currentUserName =
      localStorage.getItem('userName') ||
      localStorage.getItem('displayName') ||
      '';

    // ✅ 액션별로 schedules 테이블에 들어갈 담당자 정보 세팅
    const userMeta: any = {};

    // 신규 등록 or 최초 승인 시 → 등록자 정보
    if (!isEditMode && ['temp', 'request', 'approve'].includes(action)) {
      userMeta.created_by_id = currentUserId;
      userMeta.created_by_name = currentUserName;
    }

    // 승인 관련 액션 → 승인자 정보
    if (['approve', 'modify_approve', 'approve_modification'].includes(action)) {
      userMeta.approved_by_id = currentUserId;
      userMeta.approved_by_name = currentUserName;
    }

    // 취소 관련 액션 → 취소 처리자 정보
    if (['cancel', 'cancel_approve'].includes(action)) {
      userMeta.cancelled_by_id = currentUserId;
      userMeta.cancelled_by_name = currentUserName;
    }

    // 삭제 관련 액션 → 삭제 처리자 정보(필요하다면)
    if (['delete', 'delete_approve'].includes(action)) {
      userMeta.deleted_by_id = currentUserId;
      userMeta.deleted_by_name = currentUserName;
    }

    const formDataWithUser = {
      ...formData,

      // ✅ 히스토리용 처리자 정보 (schedule_history용)
      changed_by: currentUserId,
      changed_by_name: currentUserName,

      // ✅ schedules 담당자 메타 정보
      ...userMeta,

      // 기존 필드들 유지
      currentUserId: currentUserId,
      reason: reason || '',
      schedule_id: initialData?.scheduleData?.id || null,
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

            {/* 우측 이력 - 스튜디오 모달과 동일 구조 */}
            <div style={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 'bold', color: '#374151' }}>처리 이력</h3>
                {scheduleHistory.length > 0 && (
                  <span style={{
                    fontSize: 10,
                    backgroundColor: '#e5e7eb',
                    color: '#6b7280',
                    padding: '2px 6px',
                    borderRadius: 999
                  }}>
                    {scheduleHistory.length}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {isEditMode && initialData?.scheduleData?.id ? (
                  loadingHistory ? (
                    <div style={{
                      padding: '16px',
                      textAlign: 'center',
                      color: '#6b7280',
                      fontSize: '12px'
                    }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #e5e7eb',
                        borderTop: '2px solid #3b82f6',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 6px'
                      }} />
                      히스토리를 불러오는 중...
                    </div>
                  ) : scheduleHistory.length === 0 ? (
                    <div style={{
                      padding: '16px',
                      textAlign: 'center',
                      color: '#9ca3af',
                      fontSize: '12px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '6px',
                      border: '1px dashed #d1d5db'
                    }}>
                      변경 기록이 없습니다
                    </div>
                  ) : (
                    <div style={{ flex: 1, paddingRight: '6px' }}>
                      {scheduleHistory.map((historyItem, index) => (
                        <div key={historyItem.id || index} style={{
                          padding: '10px',
                          borderBottom: index < scheduleHistory.length - 1 ? '1px solid #e5e7eb' : 'none',
                          backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '6px'
                          }}>
                            <span style={{
                              fontSize: '12px',
                              fontWeight:
                                historyItem.action === '승인완료' || historyItem.action === '수정' ||
                                  historyItem.action === '관리자수정' ? 'bold' :
                                  historyItem.action === '등록됨' || historyItem.action === '수정요청' ||
                                    historyItem.action === '취소요청' ? '600' : 'normal',
                              color: '#374151'
                            }}>
                              {historyItem.action}
                            </span>
                            <span style={{
                              fontSize: '10px',
                              color: '#6b7280'
                            }}>
                              {formatDateTime(historyItem.created_at)}
                            </span>
                          </div>

                          <div style={{ fontSize: '11px', lineHeight: '1.3' }}>
                            <div style={{ marginBottom: '3px' }}>
                              <span style={{ fontWeight: '500', color: '#374151' }}>
                                {historyItem.action && String(historyItem.action).includes('요청') ? '요청자:' : '처리자:'}
                              </span>
                              <span style={{ marginLeft: '6px', color: '#6b7280' }}>
                                {historyItem.changed_by}
                              </span>
                            </div>

                            <div style={{ marginBottom: '3px' }}>
                              <span style={{ fontWeight: '500', color: '#374151' }}>사유:</span>
                              <span style={{ marginLeft: '6px', color: '#6b7280' }}>
                                {historyItem.reason}
                              </span>
                            </div>

                            <div>
                              <span style={{ fontWeight: '500', color: '#374151' }}>세부:</span>
                              <span style={{
                                marginLeft: '6px',
                                color: '#6b7280',
                                whiteSpace: 'pre-line'
                              }}>
                                {historyItem.details || '상세 정보 없음'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
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