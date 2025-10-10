"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { SchedulePolicy } from '../../utils/schedulePolicy';
import { ProfessorAutocomplete } from '../ProfessorAutocomplete';

interface StudioScheduleModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: any;
  locations: any[];
  userRole: string;
  onSave: (data: any, action: 'temp' | 'request' | 'approve' | 'modify_request' | 'cancel_request'|'cancel_approve') => Promise<{ success: boolean; message: string }>;
  onDelete?: (scheduleId: number) => Promise<void>;
}

// 제작센터 연락 모달 컴포넌트
const ContactCenterModal = ({ open, onClose, contactInfo }: {
  open: boolean;
  onClose: () => void;
  contactInfo: string;
}) => {
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
      zIndex: 3000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ 
          color: '#dc2626', 
          marginBottom: '16px',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          ⚠️ 온라인 수정 불가
        </h3>
        <p style={{ 
          marginBottom: '16px', 
          lineHeight: 1.5,
          color: '#374151',
          fontSize: '14px'
        }}>
          수정 가능 기간(목요일 23:59)이 지났습니다.<br/>
          스케줄 변경을 원하시면 제작센터로 연락해주세요.
        </p>
        <div style={{
          padding: '16px',
          backgroundColor: '#fef2f2',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#dc2626',
          whiteSpace: 'pre-line'
        }}>
          {contactInfo}
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          확인
        </button>
      </div>
    </div>
  );
};

// 사유 입력 모달 컴포넌트
const ReasonModal = ({ 
  open, 
  type, 
  onClose, 
  onSubmit 
}: {
  open: boolean;
  type: 'modify' | 'cancel';
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) => {
  const [reason, setReason] = useState('');

  const titles = {
    modify: '수정 요청 사유',
    cancel: '취소 요청 사유'
  };

  const placeholders = {
    modify: '수정이 필요한 이유를 입력해주세요...',
    cancel: '취소가 필요한 이유를 입력해주세요...'
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
        <h3 style={{ 
          margin: '0 0 16px 0', 
          fontSize: '18px', 
          fontWeight: 'bold',
          color: '#111827'
        }}>
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
            marginBottom: '16px',
            boxSizing: 'border-box'
          }}
        />
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'flex-end' 
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '14px'
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
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            요청 전송
          </button>
        </div>
      </div>
    </div>
  );
};

export default function StudioScheduleModal({
  open,
  onClose,
  initialData,
  locations,
  userRole,
  onSave,
  onDelete
}: StudioScheduleModalProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [userIdLoading, setUserIdLoading] = useState(true);

  // 스케줄 정책 상태
  const [policyStatus, setPolicyStatus] = useState({
    canEdit: true,
    message: '',
    contactInfo: '',
    urgencyLevel: 'safe' as 'safe' | 'warning' | 'danger'
  });

  // 모달 상태
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [requestType, setRequestType] = useState<'modify' | 'cancel'>('modify');

  // 중복 체크 상태
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [conflictDetected, setConflictDetected] = useState(false);

  // 스케줄 히스토리 상태 추가
  const [scheduleHistory, setScheduleHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 초기값 처리 함수
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

  // 버튼 표시 조건들
  const approvalStatus = initialData?.scheduleData?.approval_status;
  const isAdmin = userRole === 'admin' || userRole === 'system_admin' || userRole === 'schedule_admin';
  const isCancelRequest = approvalStatus === 'cancel_request'||
    approvalStatus === 'cancellation_requested';

  // 수정/신규 모드 구분
  const isEditMode = !!(initialData?.scheduleData && initialData.scheduleData.id);

  // 폼 데이터 상태
  const getInitialFormData = () => {
    const scheduleData = initialData?.scheduleData;
    
    if (isEditMode && scheduleData) {
      return {
        shoot_date: getInitValue(scheduleData.shoot_date || initialData.date),
        start_time: formatTimeForInput(scheduleData.start_time),
        end_time: formatTimeForInput(scheduleData.end_time),
        professor_name: getInitValue(scheduleData.professor_name),
        course_name: getInitValue(scheduleData.course_name),
        course_code: getInitValue(scheduleData.course_code),
        shooting_type: getInitValue(scheduleData.shooting_type),
        notes: getInitValue(scheduleData.notes),
        sub_location_id: getInitValue(scheduleData.sub_location_id || initialData.locationId)
      };
    } else {
      // 신규 등록 모드
      const regRange = SchedulePolicy.getRegistrationDateRange();
      
      return {
        shoot_date: getInitValue(initialData?.date || regRange.startDate),
        start_time: '',
        end_time: '',
        professor_name: '',
        course_name: '',
        course_code: '',
        shooting_type: '',
        notes: '',
        sub_location_id: getInitValue(initialData?.locationId)
      };
    }
  };

  const [formData, setFormData] = useState(getInitialFormData);
  
  const [shootingTypes, setShootingTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // 교수 자동완성 처리 함수
  const [selectedProfessorInfo, setSelectedProfessorInfo] = useState<any>(null);
  
  const handleProfessorChange = (value: string, professor?: any) => {
    setFormData(prev => ({
      ...prev,
      professor_name: value
    }));

    if (professor) {
      setSelectedProfessorInfo({
        id: professor.id,
        category_name: professor.category_name
      });
    } else {
      setSelectedProfessorInfo(null);
    }
  };

  // ESC 키 처리 추가
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open && !saving) {
        // 다른 모달이 열려있으면 해당 모달만 닫기
        if (reasonModalOpen) {
          setReasonModalOpen(false);
          return;
        }
        if (contactModalOpen) {
          setContactModalOpen(false);
          return;
        }
        // 메인 모달 닫기
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, saving, reasonModalOpen, contactModalOpen, onClose]);

  // 🔥 개선된 스케줄 히스토리 조회 함수 (하드코딩 제거)
  const fetchScheduleHistory = async (scheduleId: number) => {
    if (!scheduleId) return;

    setLoadingHistory(true);
    
    try {
      console.log('📜 스케줄 히스토리 조회 시작:', scheduleId);

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

      // 🔥 핵심 히스토리만 추려내는 함수
      const getEssentialHistory = (rawHistory: any[]) => {
        const timeChangeRegex = /시간변경:\s*([^\s→]+).*→\s*([^\s,\]]+)/;

        let essential: any[] = [];
        let found = {
          등록: false,
          승인: false,
          취소: false,
          시간변경: false
        };

        rawHistory.forEach(item => {
          // 등록
          if (!found.등록 && item.action === '등록됨') {
            essential.push(item);
            found.등록 = true;
            return;
          }
          // 승인
          if (!found.승인 && (item.action === '승인처리' || item.action === '승인완료')) {
            essential.push(item);
            found.승인 = true;
            return;
          }
          // 취소
          if (!found.취소 && item.action === '취소완료') {
            essential.push(item);
            found.취소 = true;
            return;
          }
          // 시간 변경: 가장 최근 1개만, 그리고 old/new가 다를 때만
          if (!found.시간변경 && item.reason === '시간 변경') {
            const match = item.details.match(timeChangeRegex);
            if (match && match[1] !== match[2]) { 
              essential.push({
                ...item,
                details: `시간이 ${match[1]}에서 ${match[2]}으로 변경되었습니다`
              });
              found.시간변경 = true;
            }
            return;
          }
        });

        // 최신순 정렬
        essential.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return essential;
      };

      // 🔥 사용자명 변환 함수 (실제 사용자 이름 사용)
      const getUserDisplayName = (changedBy: any): string => {
        if (!changedBy) return getCurrentUserName();
        
        // 이미 한글 이름인 경우
        if (typeof changedBy === 'string' && isNaN(Number(changedBy))) {
          return changedBy;
        }
        
        return getCurrentUserName();
      };

      // ✅ 수정된 사용자 이름 반환 함수 (하드코딩 제거)
      const getCurrentUserName = () => {
        return localStorage.getItem('userName') || 
               localStorage.getItem('displayName') || 
               'Unknown User';
      };

      // 🔥 변경 내용을 상세히 파싱하는 함수
      const parseScheduleChanges = (description: string): { reason: string; details: string } => {
        if (!description) return { reason: '스케줄 변경', details: '스케줄이 수정되었습니다' };
        
        try {
          // 시간 변경 패턴 매칭
          const timeChangePattern = /시간변경:\s*([^→]+)→([^,\]]+)/;
          const timeMatch = description.match(timeChangePattern);
          
          if (timeMatch && timeMatch.length >= 3) {
            const oldTime = String(timeMatch[1] || '').trim(); 
            const newTime = String(timeMatch[2] || '').trim();  
            
            if (oldTime && newTime) {
              return {
                reason: '시간 변경',
                details: `시간이 ${oldTime}에서 ${newTime}으로 변경되었습니다`
              };
            }
          }
          
          // 날짜 변경 패턴 매칭
          const dateChangePattern = /날짜변경:\s*([^→]+)→([^,\]]+)/;
          const dateMatch = description.match(dateChangePattern);
          
          if (dateMatch && dateMatch.length >= 3) {
            const oldDate = String(dateMatch[1] || '').trim();
            const newDate = String(dateMatch[2] || '').trim();
            
            if (oldDate && newDate) {
              return {
                reason: '날짜 변경',
                details: `촬영일이 ${oldDate}에서 ${newDate}로 변경되었습니다`
              };
            }
          }
          
          // 교수명 변경 패턴 매칭
          const professorChangePattern = /교수명변경:\s*([^→]+)→([^,\]]+)/;
          const professorMatch = description.match(professorChangePattern);
          
          if (professorMatch && professorMatch.length >= 3) {
            const oldName = String(professorMatch[1] || '').trim();
            const newName = String(professorMatch[2] || '').trim();
            
            if (oldName && newName) {
              return {
                reason: '교수명 변경',
                details: `교수명이 ${oldName}에서 ${newName}으로 변경되었습니다`
              };
            }
          }
          
          // 관리자 직접 수정
          if (description.includes('관리자 직접 수정') || description.includes('직접 수정')) {
            const requestorMatch = description.match(/\[요청자:\s*([^\]]+)\]/);
            const requestor = requestorMatch && requestorMatch[1] ? String(requestorMatch[1]).trim() : '';
            return {
              reason: '관리자 직접 수정',
              details: requestor ? `${requestor}이(가) 직접 수정했습니다` : '관리자가 직접 수정했습니다'
            };
          }
          
          // 수정 요청
          if (description.includes('수정 요청')) {
            return {
              reason: '수정 요청',
              details: description
            };
          }
          
          // 취소 관련
          if (description.includes('취소')) {
            return {
              reason: '취소 처리',
              details: description
            };
          }
          
          // 기본값
          return {
            reason: '스케줄 변경',
            details: description
          };
          
        } catch (error) {
          console.error('변경 내용 파싱 오류:', error);
          return {
            reason: '스케줄 변경',
            details: description || '스케줄이 수정되었습니다'
          };
        }
      };

      const currentUserName = getCurrentUserName();

      // 3. 히스토리 생성 (중복 제거를 위해 Map 사용)
      const historyMap = new Map<string, any>();

      // ✅ 수정된 기본 히스토리 (하드코딩 제거)
      if (scheduleData) {
        // 등록 기록 - 실제 등록자 정보 사용
        const actualCreator = scheduleData.created_by_name || 
                             scheduleData.professor_name || 
                             currentUserName;

        historyMap.set(`created_${scheduleData.id}`, {
          id: `created_${scheduleData.id}`,
          action: '등록됨',
          reason: '최초 스케줄 등록',
          changed_by: actualCreator,  // 🔥 하드코딩 제거
          created_at: scheduleData.created_at,
          details: `${scheduleData.professor_name} 교수님 스케줄 등록`,
          source: 'system'
        });

        // 현재 상태별 히스토리
        if (scheduleData.approval_status === 'approved') {
          historyMap.set(`approved_${scheduleData.id}`, {
            id: `approved_${scheduleData.id}`,
            action: '승인완료',
            reason: '관리자 승인 처리',
            changed_by: currentUserName,
            created_at: scheduleData.updated_at || scheduleData.created_at,
            details: `${scheduleData.professor_name} 교수님 스케줄 승인 완료`,
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
            details: `${scheduleData.professor_name} 교수님 스케줄 취소 처리 완료`,
            source: 'system'
          });
        }
      }

      // schedule_history 데이터 추가 (중복 제거)
      if (historyData && historyData.length > 0) {
        // 중복 제거: 같은 시간대 동일 액션 제거
        const uniqueHistory = historyData.reduce((acc: any[], current) => {
          const timeKey = new Date(current.created_at).getTime();
          const existing = acc.find(item => 
            Math.abs(new Date(item.created_at).getTime() - timeKey) < 5000 && // 5초 이내
            item.change_type === current.change_type
          );
          
          if (!existing) {
            acc.push(current);
          }
          return acc;
        }, []);

        // 의미있는 히스토리만 추가 (최대 8개)
        uniqueHistory.slice(0, 8).forEach(item => {
          const key = `history_${item.id}`;
          
          if (!historyMap.has(key)) {
            // 🔥 변경 내용 상세 파싱
            const parsedChange = parseScheduleChanges(item.description || '');
            
            // 액션명 결정
            let actionName = '수정됨';
            if (item.change_type === 'cancelled') {
              actionName = '취소요청';
            } else if (item.change_type === 'approved') {
              actionName = '승인처리';
            } else if (parsedChange.reason === '관리자 직접 수정') {
              actionName = '관리자수정';
            } else if (parsedChange.reason === '수정 요청') {
              actionName = '수정요청';
            } else if (parsedChange.reason === '시간 변경') {
              actionName = '시간변경';
            } else if (parsedChange.reason === '날짜 변경') {
              actionName = '날짜변경';
            } else if (parsedChange.reason === '교수명 변경') {
              actionName = '교수변경';
            }

            const changedByName = getUserDisplayName(item.changed_by);

            historyMap.set(key, {
              id: key,
              action: actionName,
              reason: parsedChange.reason,
              changed_by: changedByName,
              created_at: item.created_at,
              details: parsedChange.details,
              source: 'history'
            });
          }
        });
      }

      // 🔥 핵심 내역만 필터링
      const allHistory = Array.from(historyMap.values());
      const essentialHistory = getEssentialHistory(allHistory);

      setScheduleHistory(essentialHistory);
      console.log('✅ 히스토리 조회 완료:', essentialHistory.length, '개');

    } catch (error) {
      console.error('히스토리 조회 오류:', error);
      setScheduleHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ✅ 수정된 사용자 ID 조회 (테스트 계정 제거)
  useEffect(() => {
    const getCurrentUserId = async () => {
      if (!open) return;
      
      try {
        setUserIdLoading(true);

        const storedUserName = localStorage.getItem('userName');
        const storedUserRole = localStorage.getItem('userRole');

        let mappedUserId: number | null = null;

        if (storedUserName && storedUserRole) {
          // ✅ 테스트 계정 제거된 매핑
          const userMapping: { [key: string]: number } = {
            'system_admin': 1,
            'schedule_admin': 2,
            'academy_manager': 3,
            'studio_manager': 4,
            'professor': 5
            // 🔥 테스트 계정들 완전 제거
          };

          if (userMapping[storedUserName]) {
            mappedUserId = userMapping[storedUserName];
          }
          else if (userMapping[storedUserRole]) {
            mappedUserId = userMapping[storedUserRole];
          }
          else {
            mappedUserId = 5;
          }
        }

        if (mappedUserId) {
          setCurrentUserId(mappedUserId);
        } else {
          setCurrentUserId(5);
        }
        
      } catch (error) {
        console.error('❌ 사용자 ID 조회 실패:', error);
        setCurrentUserId(5);
      } finally {
        setUserIdLoading(false);
      }
    };

    getCurrentUserId();
  }, [open]);

  // 스케줄 정책 상태 체크
  useEffect(() => {
    if (open) {
      const status = SchedulePolicy.getStatusMessage();
      setPolicyStatus({
        canEdit: status.canEdit,
        message: status.message,
        contactInfo: status.contactInfo || '',
        urgencyLevel: status.urgencyLevel
      });
    }
  }, [open]);

  // 초기 데이터 로딩 (히스토리 포함)
  useEffect(() => {
    if (initialData && open) {
      setFormData(getInitialFormData());
      setSelectedProfessorInfo(null);

      if (isEditMode && initialData.scheduleData?.id) {
        fetchScheduleHistory(initialData.scheduleData.id);
      } else {
        setScheduleHistory([]);
      }
    }
  }, [initialData, open, isEditMode]);

  // 모달 닫힐 때 초기화
  useEffect(() => {
    if (!open) {
      setSaving(false);
      setMessage('');
      setUserIdLoading(true);
      setSelectedProfessorInfo(null);
      setScheduleHistory([]);
    }
  }, [open]);

  // 촬영형식 데이터 로딩
  useEffect(() => {
    if (open) {
      fetchShootingTypes();
    }
  }, [open]);

  const fetchShootingTypes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('shooting_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setShootingTypes(data || []);
    } catch (error) {
      console.error('촬영형식 조회 오류:', error);
      setShootingTypes([
        { id: 1, name: 'PPT' },
        { id: 2, name: '전자칠판' },
        { id: 3, name: '크로마키' },
        { id: 4, name: 'PC와콤' },
        { id: 5, name: 'PC' },
        { id: 6, name: '일반칠판' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 촬영형식별 호환 스튜디오 필터링
  const compatibleStudios = useMemo(() => {
    if (!formData.shooting_type) {
      return [];
    }

    if (!initialData?.shootingTypeMapping?.length) {
      const sortedStudios = locations.sort((a, b) => {
        const aNum = parseInt(a.name.toString().replace(/[^0-9]/g, '')) || 999;
        const bNum = parseInt(b.name.toString().replace(/[^0-9]/g, '')) || 999;
        return aNum - bNum;
      });
      return sortedStudios;
    }

    const shootingTypeMapping = initialData.shootingTypeMapping;
    const compatibleStudioIds = shootingTypeMapping
      .filter(mapping => mapping.shooting_types?.name === formData.shooting_type)
      .map(mapping => mapping.sub_location_id);

    const compatible = locations
      .filter(studio => compatibleStudioIds.includes(studio.id))
      .sort((a, b) => {
        const aNum = parseInt(a.name.toString().replace(/[^0-9]/g, '')) || 999;
        const bNum = parseInt(b.name.toString().replace(/[^0-9]/g, '')) || 999;
        return aNum - bNum;
      });

    return compatible;
  }, [formData.shooting_type, locations, initialData?.shootingTypeMapping]);

  // 촬영형식 변경 시 스튜디오 선택 처리
  useEffect(() => {
    if (!formData.shooting_type) {
      if (formData.sub_location_id) {
        setFormData(prev => ({
          ...prev,
          sub_location_id: ''
        }));
      }
      return;
    }

    if (compatibleStudios.length > 0) {
      const currentStudioId = parseInt(formData.sub_location_id);
      const isCurrentStudioCompatible = compatibleStudios.some(studio => studio.id === currentStudioId);

      if (isEditMode) {
        if (!isCurrentStudioCompatible) {
          const topStudio = compatibleStudios[0];
          setFormData(prev => ({
            ...prev,
            sub_location_id: topStudio.id.toString()
          }));
        }
      } else {
        const topStudio = compatibleStudios[0];
        
        if (currentStudioId !== topStudio.id) {
          setFormData(prev => ({
            ...prev,
            sub_location_id: topStudio.id.toString()
          }));
        }
      }
    } else {
      setFormData(prev => ({
        ...prev,
        sub_location_id: ''
      }));
    }
  }, [formData.shooting_type, compatibleStudios, locations, isEditMode]);

  // 중복 체크 함수
  const checkScheduleConflict = async (
    shoot_date: string,
    start_time: string,
    end_time: string,
    sub_location_id: string,
    schedule_id_to_exclude?: number
  ): Promise<boolean> => {
    if (!shoot_date || !start_time || !end_time || !sub_location_id) {
      return false;
    }

    try {
      let query = supabase
        .from('schedules')
        .select(`
          id, 
          professor_name, 
          start_time, 
          end_time, 
          sub_location_id,
          approval_status,
          sub_locations(id, name)
        `)
        .eq('shoot_date', shoot_date)
        .eq('sub_location_id', parseInt(sub_location_id))
        .eq('schedule_type', 'studio')
        .eq('is_active', true)
        .neq('approval_status', 'cancellation_requested')
        .or(`and(start_time.lt.${end_time},end_time.gt.${start_time})`);

      if (schedule_id_to_exclude) {
        query = query.neq('id', schedule_id_to_exclude);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ 중복 체크 쿼리 오류:', error);
        return false;
      }

      return Array.isArray(data) && data.length > 0;
    } catch (error) {
      console.error('❌ 중복 체크 예외:', error);
      return false;
    }
  };

  // 실시간 중복 체크
  useEffect(() => {
    const checkConflict = async () => {
      setCheckingConflict(true);
      try {
        const conflict = await checkScheduleConflict(
          formData.shoot_date,
          formData.start_time,
          formData.end_time,
          formData.sub_location_id,
          initialData?.scheduleData?.id
        );
        
        setConflictDetected(conflict);
      } catch (error) {
        setConflictDetected(false);
      } finally {
        setCheckingConflict(false);
      }
    };

    if (
      formData.shoot_date &&
      formData.start_time &&
      formData.end_time &&
      formData.sub_location_id
    ) {
      const timeoutId = setTimeout(checkConflict, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setConflictDetected(false);
      setCheckingConflict(false);
    }
  }, [formData.shoot_date, formData.start_time, formData.end_time, formData.sub_location_id, compatibleStudios]);

  // 시간 옵션 생성
  const generateStudioTimeOptions = () => {
    const options = [];
    for (let hour = 9; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
  };

  const timeOptions = generateStudioTimeOptions();

  // 폼 데이터 변경 처리
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 승인 처리 함수들
  const handleApproveModification = async () => {
    const confirmApprove = confirm(
      `${formData.professor_name} 교수님의 수정 요청을 승인하시겠습니까?\n\n` +
      `승인 후 관리자가 스케줄을 수정할 수 있습니다.`  // ✅ "매니저" → "관리자"
    );

    if (!confirmApprove) return;

    setSaving(true);
    try {
      const adminName = localStorage.getItem('userName') || 'Unknown User';  // ✅ 하드코딩 제거
      const adminId = parseInt(localStorage.getItem('userId') || '0');
      
      const { error } = await supabase
        .from('schedules')
        .update({
          approval_status: 'modification_approved',
          approved_at: new Date().toISOString(),
          approved_by: adminId,
          modification_reason: `수정 승인 완료 (승인자: ${adminName})`
        })
        .eq('id', initialData.scheduleData.id);
      
      if (error) throw error;

    const messageText = `[수정 권한 승인]\\n\\n교수명: ${formData.professor_name}\\n촬영일: ${initialData.scheduleData.shoot_date}\\n처리 결과: 수정 승인됨\\n처리자: ${adminName}\\n\\n이제 스케줄을 수정할 수 있습니다.`;

        await fetch('/api/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'approval_complete',
            message: messageText
          })
        });
        
        alert('수정 권한이 승인되었습니다. 이제 수정할 수 있습니다.');
        onClose();
      } catch (error) {
        console.error('승인 처리 오류:', error);
        alert('승인 처리 중 오류가 발생했습니다.');
      } finally {
        setSaving(false);
      }
    };

  const handleApproveCancellation = async () => {
    const confirmApprove = confirm(
      `${formData.professor_name} 교수님의 취소 요청을 승인하시겠습니까?\n\n` +
      `승인 후 스케줄이 완전히 취소됩니다.`
    );

    if (!confirmApprove) return;

    setSaving(true);
    try {
      const adminName = localStorage.getItem('userName') || 'Unknown User';  // ✅ 하드코딩 제거
      
      const { error } = await supabase
        .from('schedules')
        .update({
          approval_status: 'cancelled',
          is_active: false,
          cancellation_reason: `취소 승인 완료 (승인자: ${adminName})`
        })
        .eq('id', initialData.scheduleData.id);
      
      if (error) throw error;
      
      await supabase
        .from('schedule_history')
        .insert({
          schedule_id: initialData.scheduleData.id,
          change_type: 'approved',
          changed_by: parseInt(localStorage.getItem('userId') || '0'),  // ✅ 정수 타입으로 수정
          description: `취소 승인 처리 완료 (승인자: ${adminName})`,
          old_value: JSON.stringify(initialData.scheduleData),
          new_value: JSON.stringify({
            ...initialData.scheduleData,
            approval_status: 'cancelled'
          }),
          created_at: new Date().toISOString(),
          changed_at: new Date().toISOString()
        });
      
      alert('취소 요청이 승인되었습니다.');
      onClose();
    } catch (error) {
      console.error('취소 승인 처리 오류:', error);
      alert('취소 승인 처리 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 저장 처리
  const handleSave = async (action: 'temp' | 'request' | 'approve'|'cancel_approve') => {
    if (userIdLoading) {
      setMessage('사용자 정보를 확인하는 중입니다. 잠시만 기다려주세요.');
      return;
    }

    if (!currentUserId) {
      setMessage('사용자 정보를 확인할 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.');
      return;
    }

    if (action === 'cancel_approve') {
      const scheduleId = initialData.scheduleData.id;

      const { error } = await supabase
        .from('schedules')
        .update({
          approval_status: 'cancelled',
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduleId);

      // ✅ 수정된 adminName 변수 정의 (하드코딩 제거)
      const adminName = localStorage.getItem('userName') || 
                       localStorage.getItem('displayName') || 
                       'Unknown User';

      if (error) throw error;
      
      await supabase
        .from('schedule_history')
        .insert({
          schedule_id: scheduleId,
          change_type: 'cancelled',
          changed_by: parseInt(localStorage.getItem('userId') || '0'),  // ✅ 정수 타입으로 수정
          description: `관리자 직권 취소: ${adminName}이 직접 취소 처리`,
          old_value: JSON.stringify(initialData.scheduleData),
          new_value: JSON.stringify({
            ...initialData.scheduleData,
            approval_status: 'cancelled'
          }),
          created_at: new Date().toISOString(),
          changed_at: new Date().toISOString()
        });

      await onSave({ scheduleId }, 'cancel_approve');
      onClose();
      return;
    }

    // 수정 모드일 때 정책 체크
    if (isEditMode && action !== 'approve') {
      const canEdit = SchedulePolicy.canEditOnline();
      if (!canEdit) {
        setContactModalOpen(true);
        return;
      }
    }

    // 중복 체크
    if (conflictDetected) {
      alert('선택하신 시간대에 이미 다른 스케줄이 있습니다. 시간을 조정해주세요.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const formDataWithUser = {
        ...formData,
        currentUserId: currentUserId
      };

      const result = await onSave(formDataWithUser, action);
      
      // 🔥 저장 성공 시 상세 히스토리 기록 (수정 모드일 때)
      if (result.success && isEditMode) {
        const currentUser = localStorage.getItem('userName') || 'Unknown User';  // ✅ 하드코딩 제거
        const originalData = initialData?.scheduleData;
        
        console.log('🔍 히스토리 기록 시작:', {
          currentUser,
          originalData: {
            start_time: originalData?.start_time,
            end_time: originalData?.end_time,
            shoot_date: originalData?.shoot_date,
            professor_name: originalData?.professor_name
          },
          formData: {
            start_time: formData.start_time,
            end_time: formData.end_time,
            shoot_date: formData.shoot_date,
            professor_name: formData.professor_name
          }
        });
        
        // 상세한 변경 내용 비교
        const changes = [];
        
        if (originalData?.start_time !== formData.start_time || originalData?.end_time !== formData.end_time) {
          changes.push(`시간변경: ${originalData?.start_time}~${originalData?.end_time} → ${formData.start_time}~${formData.end_time}`);
        }
        
        if (originalData?.shoot_date !== formData.shoot_date) {
          changes.push(`날짜변경: ${originalData?.shoot_date} → ${formData.shoot_date}`);
        }
        
        if (originalData?.professor_name !== formData.professor_name) {
          changes.push(`교수명변경: ${originalData?.professor_name} → ${formData.professor_name}`);
        }
        
        console.log('🔍 감지된 변경사항:', changes);
        
        // 변경사항이 있을 때만 기록
        if (changes.length > 0) {
          const detailsText = changes.join(', ');
          const actionType = action === 'approve' ? 'approved' : 'modification_requested';
          
          // 🔥 실제 입력된 사유 사용
          let reasonText = '';
          if (action === 'approve') {
            reasonText = '관리자 직접 수정';
          } else {
            reasonText = modificationReason || selectedProfessorInfo?.reason || '시간변경';
          }
          
          console.log('🔍 기록할 히스토리:', { actionType, reasonText, detailsText });
          
          try {
            const historyResult = await supabase
              .from('schedule_history')
              .insert({
                schedule_id: initialData.scheduleData.id,
                change_type: actionType,
                description: `수정 요청: ${reasonText} [요청자: ${currentUser}]`, // 🔥 사유 포함
                changed_by: currentUserId,  // ✅ 정수 타입으로 수정
                old_value: JSON.stringify(originalData),
                new_value: JSON.stringify(formData),
                changed_at: new Date().toISOString()
              });

              // 🔥 메시지 발송 추가
              if (action === 'approve') {
                const messageText = `[스케줄 수정 완료]\\n\\n교수명: ${formData.professor_name}\\n촬영일: ${formData.shoot_date}\\n시간: ${formData.start_time}~${formData.end_time}\\n처리자: ${currentUser}\\n\\n스케줄이 최종 수정되었습니다.`;
                
                await fetch('/api/message', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: 'schedule_modified',
                    message: messageText
                  })
                });
               }
              
            console.log('✅ 히스토리 기록 성공:', historyResult);
          } catch (historyError) {
            console.error('❌ 히스토리 기록 실패:', historyError);
          }
        }
      }

      setMessage(result.message);

      if (result.success) {
        alert(result.message);
        onClose();
        setMessage('');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.';
      setMessage(errorMessage);
      alert(errorMessage);
      console.error('저장 오류:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditMode || !initialData?.scheduleData?.id) {
      alert('삭제할 수 없는 스케줄입니다.');
      return;
    }

    const confirmDelete = confirm(
      `정말로 이 스케줄을 삭제하시겠습니까?\n\n` +
      `교수명: ${formData.professor_name}\n` +
      `날짜: ${formData.shoot_date}\n` +
      `시간: ${formData.start_time} ~ ${formData.end_time}\n\n` +
      `※ 삭제된 스케줄은 복구할 수 없습니다.`
    );

    if (!confirmDelete) return;

    setSaving(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('schedules')
        .update({
          is_active: false,
          approval_status: 'cancelled',
          deletion_reason: 'admin_deleted',
          updated_at: new Date().toISOString()
        })
        .eq('id', initialData.scheduleData.id);

      if (error) throw error;

      alert('스케줄이 삭제되었습니다.');
      
      if (onDelete) {
        await onDelete(initialData.scheduleData.id);
      }
      
      onClose();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.';
      setMessage(errorMessage);
      alert(errorMessage);
      console.error('삭제 오류:', error);
    } finally {
      setSaving(false);
    }
  };

  // StudioScheduleModal 컴포넌트에 상태 추가
  const [modificationReason, setModificationReason] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');

  // handleRequestWithReason 함수 수정
  const handleRequestWithReason = (reason: string) => {
    if (requestType === 'modify') {
      setModificationReason(reason);
    } else if (requestType === 'cancel') {
      setCancellationReason(reason);
    }
    
    setReasonModalOpen(false);
    handleSave(actionMap[requestType] as 'temp');
  };

  // 스튜디오 옵션 라벨 생성 함수
  const getStudioOptionLabel = (studio: any) => {
    let label = `${studio.name}번 스튜디오`;

    if (initialData?.shootingTypeMapping?.length && formData.shooting_type) {
      const studioMappings = initialData.shootingTypeMapping.filter(
        mapping => mapping.sub_location_id === studio.id
      );

      const supportedTypes = studioMappings.map(mapping => mapping.shooting_types?.name).filter(Boolean);
      const isPrimary = studioMappings.some(mapping =>
        mapping.shooting_types?.name === formData.shooting_type && mapping.is_primary
      );

      if (supportedTypes.includes(formData.shooting_type)) {
        label += isPrimary ? ' - 주 촬영형식' : ' - 지원';
      }
    }

    return label;
  };

  // ✅ 수정된 히스토리 액션 타입별 한국어 변환 (하드코딩 제거)
  const getActionText = (action: string) => {
    const styleMap: { [key: string]: { text: string } } = {
      'UPDATE': { text: '수정' },
      'created': { text: '등록됨' },
      'modified': { text: '수정됨' },
      'cancelled': { text: '취소됨' },
      'approved': { text: '승인됨' },
      'rejected': { text: '거부됨' },
      'modification_requested': { text: '수정요청' },
      'modification_approved': { text: '수정승인' },
      'schedule_modified': { text: '관리자수정' },  // ✅ "매니저수정" → "관리자수정"
      'schedule_cancelled': { text: '관리자취소' }, // ✅ "매니저취소" → "관리자취소"
      '등록됨': { text: '등록됨' },
      '수정요청': { text: '수정요청' },
      '승인완료': { text: '승인완료' },
      '수정': { text: '수정' }
    };

    const style = styleMap[action] || { text: action };
    return style;
  };

  // 날짜 포맷팅 함수
  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 히스토리 아이템 배경색 결정 함수
  const getHistoryItemStyle = (action: string, source: string) => {
    if (action === 'cancelled' || action === 'schedule_cancelled') {
      return {
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca',
        iconColor: '#dc2626'
      };
    }
    if (action === 'modified' || action === 'schedule_modified' || action === 'modification_requested') {
      return {
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
        iconColor: '#059669'
      };
    }
    if (action === 'approved') {
      return {
        backgroundColor: '#eff6ff',
        borderColor: '#dbeafe',
        iconColor: '#2563eb'
      };
    }
    return {
      backgroundColor: '#f9fafb',
      borderColor: '#e5e7eb',
      iconColor: '#6b7280'
    };
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
          width: '800px',
          maxWidth: '95vw',
          minHeight: '500px',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 헤더 */}
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
              {isEditMode ? '🔧 스튜디오 스케줄 관리' : '📝 스튜디오 스케줄 등록'}
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

          {/* 메인 콘텐츠 영역 (2컬럼 레이아웃) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isEditMode && scheduleHistory.length > 0 ? '1fr 350px' : '1fr',
            gap: '24px',
            padding: '24px',
            flex: 1,
            overflowY: 'auto'
          }}>
            {/* 왼쪽: 폼 필드들 */}
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
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: saving ? '#f9fafb' : 'white'
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
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: saving ? '#f9fafb' : 'white'
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
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: saving ? '#f9fafb' : 'white'
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
                  {/* ProfessorAutocomplete 컴포넌트 */}
                  <ProfessorAutocomplete
                    value={formData.professor_name || ''}
                    onChange={(value) => handleChange('professor_name', value)}
                    disabled={saving}
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
                    강의명
                  </label>
                  <input
                    type="text"
                    value={formData.course_name}
                    onChange={(e) => handleChange('course_name', e.target.value)}
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: saving ? '#f9fafb' : 'white'
                    }}
                  />
                </div>
              </div>

              {/* 강의코드 */}
              <div style={{ marginBottom: '20px' }}>
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
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: saving ? '#f9fafb' : 'white'
                  }}
                />
              </div>

              {/* 촬영형식 */}
              <div style={{ marginBottom: '20px' }}>
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
                  disabled={saving || isLoading}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: saving || isLoading ? '#f9fafb' : 'white'
                  }}
                >
                  <option value="">촬영형식 선택</option>
                  {shootingTypes.map(type => (
                    <option key={type.id} value={type.name}>{type.name}</option>
                  ))}
                </select>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '4px'
                }}>
                  {formData.shooting_type ? 
                    `선택된 촬영형식에 호환되는 스튜디오만 아래에 표시됩니다.` :
                    '촬영형식을 먼저 선택하면 호환되는 스튜디오만 표시됩니다.'
                  }
                </div>
              </div>

              {/* 스튜디오 선택 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  스튜디오 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                
                <select
                  value={formData.sub_location_id}
                  onChange={(e) => handleChange('sub_location_id', e.target.value)}
                  disabled={saving || (!formData.shooting_type)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: saving || (!formData.shooting_type) ? '#f9fafb' : 'white'
                  }}
                >
                  {(() => {
                    if (!formData.shooting_type) {
                      return <option value="">촬영형식을 먼저 선택해주세요</option>;
                    }
                    
                    if (compatibleStudios.length === 0) {
                      return <option value="">호환되는 스튜디오가 없습니다</option>;
                    }
                    
                    return (
                      <>
                        {!formData.sub_location_id && (
                          <option value="">스튜디오 선택</option>
                        )}
                        {compatibleStudios.map(studio => {
                          const optionLabel = getStudioOptionLabel(studio);
                          
                          return (
                            <option key={`studio-${studio.id}`} value={studio.id.toString()}>
                              {optionLabel}
                            </option>
                          );
                        })}
                      </>
                    );
                  })()}
                </select>
                
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '4px'
                }}>
                  {(() => {
                    if (!formData.shooting_type) {
                      return '촬영형식을 선택하면 호환되는 스튜디오만 표시됩니다.';
                    }
                    
                    if (compatibleStudios.length === 0) {
                      return `"${formData.shooting_type}" 촬영형식과 호환되는 스튜디오가 없습니다.`;
                    }
                    
                    if (formData.sub_location_id) {
                      const selectedStudio = compatibleStudios.find(s => s.id.toString() === formData.sub_location_id);
                      return `선택됨: ${selectedStudio ? `${selectedStudio.name}번 스튜디오` : '알 수 없음'} | 총 ${compatibleStudios.length}개 호환`;
                    }
                    
                    return `"${formData.shooting_type}" 촬영형식 호환 스튜디오: ${compatibleStudios.length}개`;
                  })()}
                </div>
              </div>

              {/* 중복 체크 안내 */}
              {checkingConflict && (
                <div style={{
                  color: '#2563eb',
                  marginBottom: '12px',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}>
                  🔍 스튜디오를 확인 중입니다...
                </div>
              )}

              {!checkingConflict && conflictDetected && (
                <div style={{
                  color: '#dc2626',
                  marginBottom: '12px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  padding: '8px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '4px'
                }}>
                  ⚠️ 선택하신 날짜와 시간에 이미 같은 스튜디오에서 예약된 스케줄이 있습니다. 시간을 조정해주세요.
                </div>
              )}

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
                  disabled={saving}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: saving ? '#f9fafb' : 'white',
                    resize: 'vertical',
                    minHeight: '80px'
                  }}
                />
              </div>
            </div>

            {/* 오른쪽: 변경 히스토리 (수정 모드일 때만 표시) */}
            {isEditMode && (
              <div style={{
                borderLeft: '1px solid #e5e7eb',
                paddingLeft: '24px'
              }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  변경 히스토리
                  {scheduleHistory.length > 0 && (
                    <span style={{
                      fontSize: '12px',
                      backgroundColor: '#e5e7eb',
                      color: '#6b7280',
                      padding: '2px 6px',
                      borderRadius: '10px'
                    }}>
                      {scheduleHistory.length}
                    </span>
                  )}
                </h3>

                {loadingHistory ? (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: '14px'
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid #e5e7eb',
                      borderTop: '2px solid #3b82f6',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 8px'
                    }} />
                    히스토리를 불러오는 중...
                  </div>
                ) : scheduleHistory.length === 0 ? (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: '#9ca3af',
                    fontSize: '14px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px dashed #d1d5db'
                  }}>
                    변경 기록이 없습니다
                  </div>
                ) : (
                  <div style={{
                    maxHeight: '800px',
                    overflowY: 'auto',
                    paddingRight: '8px'
                  }}>
                    {scheduleHistory.map((historyItem, index) => {
                      return (
                        <div key={historyItem.id || index} style={{
                          padding: '16px',
                          borderBottom: index < scheduleHistory.length - 1 ? '1px solid #e5e7eb' : 'none',
                          backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '8px'
                          }}>
                            <span style={{
                              fontSize: '14px',
                              fontWeight: historyItem.action === '승인완료' || historyItem.action === '수정' || 
                                        historyItem.action === '관리자수정' ? 'bold' : 
                                        historyItem.action === '등록됨' || historyItem.action === '수정요청' || 
                                        historyItem.action === '취소요청' ? '600' : 'normal',
                              color: '#374151'
                            }}>
                              {historyItem.action}
                            </span>
                            <span style={{
                              fontSize: '12px',
                              color: '#6b7280'
                            }}>
                              {formatDateTime(historyItem.created_at)}
                            </span>
                          </div>
                          
                          <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                            <div style={{ marginBottom: '4px' }}>
                              <span style={{ fontWeight: '500', color: '#374151' }}>
                                {historyItem.action.includes('요청') ? '요청자:' : '처리자:'}
                              </span>
                              <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                                {historyItem.changed_by}
                              </span>
                            </div>
                            
                            <div style={{ marginBottom: '4px' }}>
                              <span style={{ fontWeight: '500', color: '#374151' }}>사유:</span>
                              <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                                {historyItem.reason}
                              </span>
                            </div>
                            
                            <div>
                              <span style={{ fontWeight: '500', color: '#374151' }}>세부내용:</span>
                              <span style={{ 
                                marginLeft: '8px', 
                                color: '#6b7280',
                                whiteSpace: 'pre-line'  // 🔥 줄바꿈 처리
                              }}>
                                {historyItem.details || '상세 정보 없음'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
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

          {/* 취소 히스토리 🔥 새로 추가할 부분 */}
          {isEditMode && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#f0f9ff',
              borderRadius: '6px',
              border: '1px solid #dbeafe'
            }}>
              <div style={{ 
                fontSize: '13px', 
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '600' }}>📊 현재 상태:</span>
                {(() => {
                  const status = initialData?.scheduleData?.approval_status;
                  const statusText = {
                    'pending': '승인 대기중',
                    'approved': '승인 완료',
                    'confirmed': '승인 완료', 
                    'modification_requested': '수정 승인 대기중',
                    'modification_approved': '수정 승인됨',
                    'cancellation_requested': '취소 승인 대기중',
                    'cancelled': '취소됨'
                  }[status] || status;
                  
                  return (
                    <>
                      <span>{statusText}</span>
                      {initialData?.scheduleData?.updated_at && (
                        <span style={{ color: '#6b7280', fontSize: '12px' }}>
                          • {new Date(initialData.scheduleData.updated_at).toLocaleString('ko-KR')}
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 버튼 영역 */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}>
            {/* 좌측: 관리자 승인 버튼들 */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {isAdmin && approvalStatus === 'modification_requested' && (
                <button
                  onClick={handleApproveModification}
                  disabled={saving}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: saving ? '#d1d5db' : '#7700ffff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  수정 승인
                </button>
              )}

              {isAdmin && approvalStatus === 'cancellation_requested' && (
                <button
                  onClick={handleApproveCancellation}
                  disabled={saving}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: saving ? '#d1d5db' : '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  취소 승인
                </button>
              )}
            </div>

            {/* 우측: 기존 버튼들 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {saving && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '14px', height: '14px',
                    border: '2px solid #d1d5db',
                    borderTop: '2px solid #059669',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>처리 중...</span>
                </div>
              )}

              {/* 스케줄 취소 버튼 (수정 모드일 때만 표시) */}
              {isEditMode && (
                <button
                  onClick={() => {
                    const confirmCancel = confirm(
                      `정말로 이 스케줄을 취소하시겠습니까?\n\n` +
                      `교수명: ${formData.professor_name}\n` +
                      `날짜: ${formData.shoot_date}\n` +
                      `시간: ${formData.start_time} ~ ${formData.end_time}\n\n` +
                      `※ 관리자 직권으로 즉시 취소됩니다.`
                    );
                    
                    if (confirmCancel) {
                      handleSave('cancel_approve');
                    }
                  }}
                  disabled={saving}
                  style={{
                    padding: '10px 16px',
                    border: '1px solid #dc2626',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    color: '#dc2626',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: saving ? 0.5 : 1
                  }}
                >
                  스케줄 취소
                </button>
              )}

              {isAdmin && isEditMode && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: saving ? '#d1d5db' : '#dc2626',
                    color: 'white',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  삭제
                </button>
              )}

              {isAdmin ? (
                <>
                  <button
                    onClick={() => handleSave('temp')}
                    disabled={saving || checkingConflict || conflictDetected}
                    style={{
                      padding: '10px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: (saving || checkingConflict || conflictDetected) ? '#d1d5db' : '#6b7280',
                      color: 'white',
                      cursor: (saving || checkingConflict || conflictDetected) ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    임시저장
                  </button>
                  <button
                    onClick={() => handleSave('approve')}
                    disabled={saving || checkingConflict || conflictDetected}
                    style={{
                      padding: '10px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: (saving || checkingConflict || conflictDetected) ? '#d1d5db' : '#059669',
                      color: 'white',
                      cursor: (saving || checkingConflict || conflictDetected) ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    승인
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleSave('temp')}
                    disabled={saving || checkingConflict || conflictDetected}
                    style={{
                      padding: '10px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: (saving || checkingConflict || conflictDetected) ? '#d1d5db' : '#6b7280',
                      color: 'white',
                      cursor: (saving || checkingConflict || conflictDetected) ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    임시저장
                  </button>
                  <button
                    onClick={() => handleSave('request')}
                    disabled={saving || checkingConflict || conflictDetected}
                    style={{
                      padding: '10px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: (saving || checkingConflict || conflictDetected) ? '#d1d5db' : '#2563eb',
                      color: 'white',
                      cursor: (saving || checkingConflict || conflictDetected) ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    승인요청
                  </button>
                </>
              )}
            </div>
          </div>

          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>

      {/* 제작센터 연락 모달 */}
      <ContactCenterModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        contactInfo={policyStatus.contactInfo}
      />

      {/* 사유 입력 모달 */}
      <ReasonModal
        open={reasonModalOpen}
        type={requestType}
        onClose={() => setReasonModalOpen(false)}
        onSubmit={handleRequestWithReason}
      />
    </>
  );
}
