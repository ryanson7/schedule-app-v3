"use client";
import { useState, useEffect } from "react";
import { ScheduleFormData, Location } from "../../../types/academy";

interface RegistrationModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: {
    date: string;
    locationId: number;
    scheduleData?: ScheduleFormData;
  };
  locations: { value: number; label: string; disabled?: boolean }[];
  shootingTypes: string[];
  userRole: 'admin' | 'manager' | 'user';
  pageType: 'academy' | 'studio';
  onSave: (data: ScheduleFormData, action: 'temp' | 'request' | 'approve') => Promise<{ success: boolean; message: string }>;
}

export default function RegistrationModal({
  open,
  onClose,
  initialData,
  locations,
  shootingTypes,
  userRole,
  pageType,
  onSave
}: RegistrationModalProps) {
  const [formData, setFormData] = useState<ScheduleFormData>({
    shoot_date: '',
    start_time: '',
    end_time: '',
    professor_name: '',
    course_name: '',
    course_code: '',
    shooting_type: pageType === 'academy' ? '촬영' : 'PPT',
    notes: '',
    sub_location_id: 0
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
        ...(initialData.scheduleData || {})
      }));
      setErrors({});
    }
  }, [open, initialData]);

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
        shooting_type: pageType === 'academy' ? '촬영' : 'PPT',
        notes: '',
        sub_location_id: 0
      });
      setErrors({});
    }
  }, [open, pageType]);

  // 안전한 값 변환
  const getSafeValue = (value: any): string => {
    if (value && typeof value === 'object' && 'target' in value) {
      return value.target.value || '';
    }
    return String(value || '');
  };

  const getSafeNumber = (value: any): number => {
    const strValue = getSafeValue(value);
    const num = parseInt(strValue, 10);
    return isNaN(num) ? 0 : num;
  };

  // 필드 업데이트
  const updateField = (field: keyof ScheduleFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'sub_location_id' ? getSafeNumber(value) : getSafeValue(value)
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
      newErrors.sub_location_id = `${pageType === 'academy' ? '강의실' : '스튜디오'}을 선택하세요`;
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
        times.push(`${h}:${m}`);
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  if (!open) return null;

  const modalTitle = pageType === 'academy' ? '🏫 학원' : '🎬 스튜디오';
  const locationLabel = pageType === 'academy' ? '강의실' : '스튜디오';

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
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
                촬영 날짜 *
              </label>
              <input
                type="date"
                value={formData.shoot_date}
                onChange={(e) => updateField('shoot_date', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${errors.shoot_date ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                required
              />
              {errors.shoot_date && (
                <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                  {errors.shoot_date}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
                {locationLabel} *
              </label>
              <select
                value={formData.sub_location_id}
                onChange={(e) => updateField('sub_location_id', parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${errors.sub_location_id ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                required
              >
                <option value={0}>{locationLabel}을 선택하세요</option>
                {locations.map(location => (
                  <option key={location.value} value={location.value} disabled={location.disabled}>
                    {location.label}
                  </option>
                ))}
              </select>
              {errors.sub_location_id && (
                <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                  {errors.sub_location_id}
                </span>
              )}
            </div>
          </div>

          {/* 시간 정보 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
                시작 시간 *
              </label>
              <select
                value={formData.start_time}
                onChange={(e) => updateField('start_time', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${errors.start_time ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                required
              >
                <option value="">시작 시간 선택</option>
                {timeOptions.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
              {errors.start_time && (
                <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                  {errors.start_time}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
                종료 시간 *
              </label>
              <select
                value={formData.end_time}
                onChange={(e) => updateField('end_time', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${errors.end_time ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                required
              >
                <option value="">종료 시간 선택</option>
                {timeOptions.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
              {errors.end_time && (
                <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                  {errors.end_time}
                </span>
              )}
            </div>
          </div>

          {/* 강의 정보 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
                교수명 *
              </label>
              <input
                type="text"
                value={formData.professor_name}
                onChange={(e) => updateField('professor_name', e.target.value)}
                placeholder="교수명을 입력하세요"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${errors.professor_name ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                required
              />
              {errors.professor_name && (
                <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                  {errors.professor_name}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
                강의명
              </label>
              <input
                type="text"
                value={formData.course_name}
                onChange={(e) => updateField('course_name', e.target.value)}
                placeholder="강의명을 입력하세요"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
                강의코드
              </label>
              <input
                type="text"
                value={formData.course_code}
                onChange={(e) => updateField('course_code', e.target.value)}
                placeholder="강의코드를 입력하세요"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
                촬영형식 *
              </label>
              <select
                value={formData.shooting_type}
                onChange={(e) => updateField('shooting_type', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${errors.shooting_type ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                required
              >
                {shootingTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.shooting_type && (
                <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                  {errors.shooting_type}
                </span>
              )}
            </div>
          </div>

          {/* 비고 */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
              비고
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="추가 정보나 특이사항을 입력하세요"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

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
