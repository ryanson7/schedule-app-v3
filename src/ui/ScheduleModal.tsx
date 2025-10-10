"use client";
import { useState, useEffect } from "react";
import { BaseSchedule, Location, ScheduleType } from "../core/types";
import { Input } from "./Input";
import { Select } from "./Select";
import { TextArea } from "./TextArea";

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  scheduleType: ScheduleType;
  initialData?: {
    date: string;
    locationId: number;
    scheduleData?: BaseSchedule;
  };
  locations: Location[];
  userRole: 'admin' | 'manager' | 'user';
  onSave: (data: BaseSchedule, action: 'temp' | 'request' | 'approve') => Promise<{ success: boolean; message: string }>;
}

export default function ScheduleModal({
  open,
  onClose,
  scheduleType,
  initialData,
  locations,
  userRole,
  onSave
}: ScheduleModalProps) {
  const [formData, setFormData] = useState<BaseSchedule>({
    shoot_date: '',
    start_time: '',
    end_time: '',
    professor_name: '',
    course_name: '',
    course_code: '',
    shooting_type: scheduleType === 'academy' ? '촬영' : 'PPT',
    notes: '',
    sub_location_id: 0,
    schedule_type: scheduleType,
    approval_status: 'temp',
    team_id: 1,
    is_active: true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // 초기 데이터 설정
  useEffect(() => {
    if (open && initialData) {
      setFormData(prev => ({
        ...prev,
        shoot_date: initialData.date || '',
        sub_location_id: initialData.locationId || 0,
        schedule_type: scheduleType,
        ...(initialData.scheduleData || {})
      }));
      setErrors({});
    }
  }, [open, initialData, scheduleType]);

  // 폼 리셋
  useEffect(() => {
    if (!open) {
      setFormData({
        shoot_date: '',
        start_time: '',
        end_time: '',
        professor_name: '',
        course_name: '',
        course_code: '',
        shooting_type: scheduleType === 'academy' ? '촬영' : 'PPT',
        notes: '',
        sub_location_id: 0,
        schedule_type: scheduleType,
        approval_status: 'temp',
        team_id: 1,
        is_active: true
      });
      setErrors({});
    }
  }, [open, scheduleType]);

  // 필드 업데이트
  const updateField = (field: keyof BaseSchedule, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'sub_location_id' ? Number(value) : String(value)
    }));

    // 에러 클리어
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // 폼 검증
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.shoot_date) {
      newErrors.shoot_date = '촬영 날짜를 선택하세요';
    }

    if (!formData.start_time) {
      newErrors.start_time = '시작 시간을 선택하세요';
    }

    if (!formData.end_time) {
      newErrors.end_time = '종료 시간을 선택하세요';
    }

    if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
      newErrors.end_time = '종료 시간은 시작 시간보다 늦어야 합니다';
    }

    if (!formData.professor_name.trim()) {
      newErrors.professor_name = '교수명을 입력하세요';
    }

    if (!formData.shooting_type) {
      newErrors.shooting_type = '촬영형식을 선택하세요';
    }

    if (!formData.sub_location_id || formData.sub_location_id === 0) {
      newErrors.sub_location_id = `${scheduleType === 'academy' ? '강의실' : '스튜디오'}을 선택하세요`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 저장 처리
  const handleSave = async (action: 'temp' | 'request' | 'approve') => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const result = await onSave(formData, action);
      
      if (result.success) {
        alert(result.message);
        onClose();
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 시간 옵션 생성
  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 9; hour < 22; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const h = hour.toString().padStart(2, "0");
        const m = min.toString().padStart(2, "0");
        times.push({ value: `${h}:${m}`, label: `${h}:${m}` });
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  // 촬영형식 옵션
  const shootingTypeOptions = scheduleType === 'academy' 
    ? [
        { value: '촬영', label: '촬영' },
        { value: '라이브', label: '라이브' },
        { value: '녹화', label: '녹화' },
        { value: '화상강의', label: '화상강의' }
      ]
    : [
        { value: 'PPT', label: 'PPT' },
        { value: '일반칠판', label: '일반칠판' },
        { value: '전자칠판', label: '전자칠판' },
        { value: '크로마키', label: '크로마키' },
        { value: 'PC와콤', label: 'PC와콤' },
        { value: 'PC', label: 'PC' }
      ];

  if (!open) return null;

  const modalTitle = scheduleType === 'academy' ? '🏫 학원' : '🎬 스튜디오';
  const locationLabel = scheduleType === 'academy' ? '강의실' : '스튜디오';

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
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        width: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: '20px', 
            fontWeight: '600',
            color: '#1f2937'
          }}>
            {modalTitle} 스케줄 {formData.id ? '수정' : '등록'}
          </h2>
          
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 기본 정보 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input
              label="촬영 날짜"
              type="date"
              value={formData.shoot_date}
              onChange={(value) => updateField('shoot_date', value)}
              error={errors.shoot_date}
              required
            />
            
            <Select
              label={locationLabel}
              value={formData.sub_location_id}
              onChange={(value) => updateField('sub_location_id', value)}
              options={[
                { value: 0, label: `${locationLabel}을 선택하세요` },
                ...locations.map(location => ({
                  value: location.id,
                  label: `${location.main_locations?.name} - ${location.name}`
                }))
              ]}
              error={errors.sub_location_id}
              required
            />
          </div>

          {/* 시간 정보 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Select
              label="시작 시간"
              value={formData.start_time}
              onChange={(value) => updateField('start_time', value)}
              options={[
                { value: '', label: '시작 시간 선택' },
                ...timeOptions
              ]}
              error={errors.start_time}
              required
            />
            
            <Select
              label="종료 시간"
              value={formData.end_time}
              onChange={(value) => updateField('end_time', value)}
              options={[
                { value: '', label: '종료 시간 선택' },
                ...timeOptions
              ]}
              error={errors.end_time}
              required
            />
          </div>

          {/* 강의 정보 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input
              label="교수명"
              value={formData.professor_name}
              onChange={(value) => updateField('professor_name', value)}
              placeholder="교수명을 입력하세요"
              error={errors.professor_name}
              required
            />
            
            <Input
              label="강의명"
              value={formData.course_name}
              onChange={(value) => updateField('course_name', value)}
              placeholder="강의명을 입력하세요"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input
              label="강의코드"
              value={formData.course_code || ''}
              onChange={(value) => updateField('course_code', value)}
              placeholder="강의코드를 입력하세요"
            />
            
            <Select
              label="촬영형식"
              value={formData.shooting_type}
              onChange={(value) => updateField('shooting_type', value)}
              options={shootingTypeOptions}
              error={errors.shooting_type}
              required
            />
          </div>

          {/* 비고 */}
          <TextArea
            label="비고"
            value={formData.notes || ''}
            onChange={(value) => updateField('notes', value)}
            placeholder="추가 정보나 특이사항을 입력하세요"
            rows={3}
          />

          {/* 버튼 영역 */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white',
                color: '#374151',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              취소
            </button>
            
            <button
              onClick={() => handleSave('temp')}
              disabled={loading}
              style={{
                padding: '10px 20px',
                border: '1px solid #6b7280',
                borderRadius: '6px',
                backgroundColor: '#6b7280',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              임시저장
            </button>
            
            {userRole === 'admin' ? (
              <button
                onClick={() => handleSave('approve')}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #22c55e',
                  borderRadius: '6px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                승인 완료
              </button>
            ) : (
              <button
                onClick={() => handleSave('request')}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #3b82f6',
                  borderRadius: '6px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                등록 요청
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
