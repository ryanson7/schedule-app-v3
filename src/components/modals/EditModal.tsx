"use client";
import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';

const generateTimeOptions = () => {
  const times = [];
  for (let hour = 7; hour < 22; hour++) {
    for (let min = 0; min < 60; min += 10) {
      const h = hour.toString().padStart(2, "0");
      const m = min.toString().padStart(2, "0");
      times.push(`${h}:${m}`);
    }
  }
  return times;
};

const timeOptions = generateTimeOptions();

// 공통 스타일 토큰
const styles = {
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block' as const,
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b'
  },
  required: {
    color: '#dc2626'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '2px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
    transition: 'border-color 0.2s'
  },
  formRow: {
    display: 'grid' as const,
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '16px'
  },
  buttonGroup: {
    display: 'flex' as const,
    gap: '12px',
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid #e2e8f0'
  },
  buttonPrimary: {
    flex: 1,
    padding: '12px 20px',
    background: '#059669',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    transition: 'background 0.2s',
    fontFamily: 'inherit'
  },
  buttonSecondary: {
    flex: 1,
    padding: '12px 20px',
    background: '#f8fafc',
    color: '#1e293b',
    border: '2px solid #e2e8f0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  },
  buttonDanger: {
    padding: '12px 20px',
    background: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    transition: 'background 0.2s',
    fontFamily: 'inherit'
  }
};

interface EditModalProps {
  open: boolean;
  onClose: () => void;
  schedule: any;
  studioLocations?: any[];
  timeOptions?: string[];
  onSave: (updatedSchedule: any) => void;
  onDelete?: (scheduleId: number) => void;
  isLoading?: boolean;
  type?: 'studio' | 'academy';
}

export const EditModal = ({
  open,
  onClose,
  schedule,
  studioLocations = [],
  timeOptions: customTimeOptions = timeOptions,
  onSave,
  onDelete,
  isLoading = false,
  type = 'studio'
}: EditModalProps) => {
  const [formData, setFormData] = useState({
    shoot_date: '',
    start_time: '',
    end_time: '',
    professor_name: '',
    course_name: '',
    course_code: '',
    shooting_type: 'PPT',
    sub_location_id: 0,
    notes: ''
  });

  useEffect(() => {
    if (schedule) {
      setFormData({
        shoot_date: schedule.shoot_date || '',
        start_time: schedule.start_time || '',
        end_time: schedule.end_time || '',
        professor_name: schedule.professor_name || '',
        course_name: schedule.course_name || '',
        course_code: schedule.course_code || '',
        shooting_type: schedule.shooting_type || 'PPT',
        sub_location_id: schedule.sub_location_id || 0,
        notes: schedule.notes || ''
      });
    }
  }, [schedule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.shoot_date || !formData.start_time || !formData.end_time || !formData.professor_name) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }

    if (type === 'studio' && !formData.sub_location_id) {
      alert('스튜디오를 선택해주세요.');
      return;
    }

    if (type === 'academy' && !formData.course_name) {
      alert('과목명을 입력해주세요.');
      return;
    }

    onSave({ ...schedule, ...formData });
  };

  const handleDelete = () => {
    if (!confirm('이 스케줄을 삭제하시겠습니까?')) return;
    
    if (onDelete && schedule?.id) {
      onDelete(schedule.id);
    }
  };

  if (!open || !schedule) return null;

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={`${type === 'studio' ? '스튜디오' : '학원'} 스케줄 수정`}
      size="medium"
    >
      <form onSubmit={handleSubmit}>
        <div>
          {/* 날짜 */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              날짜 <span style={styles.required}>*</span>
            </label>
            <input 
              type="date" 
              value={formData.shoot_date}
              onChange={(e) => setFormData({...formData, shoot_date: e.target.value})}
              style={styles.input}
              required 
            />
          </div>

          {/* 시간 */}
          <div style={styles.formRow}>
            <div>
              <label style={styles.label}>
                시작 시간 <span style={styles.required}>*</span>
              </label>
              <select 
                value={formData.start_time}
                onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                style={styles.input}
                required
              >
                <option value="">선택</option>
                {customTimeOptions.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>
                종료 시간 <span style={styles.required}>*</span>
              </label>
              <select 
                value={formData.end_time}
                onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                style={styles.input}
                required
              >
                <option value="">선택</option>
                {customTimeOptions.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 교수명/강사명 */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              {type === 'studio' ? '교수명' : '강사명'} <span style={styles.required}>*</span>
            </label>
            <input 
              type="text"
              value={formData.professor_name}
              onChange={(e) => setFormData({...formData, professor_name: e.target.value})}
              style={styles.input}
              placeholder={type === 'studio' ? '교수명을 입력하세요' : '강사명을 입력하세요'}
              required
            />
          </div>

          {/* 스튜디오 (스튜디오 타입일 때만) */}
          {type === 'studio' && (
            <div style={styles.formGroup}>
              <label style={styles.label}>
                스튜디오 <span style={styles.required}>*</span>
              </label>
              <select 
                value={formData.sub_location_id}
                onChange={(e) => setFormData({...formData, sub_location_id: parseInt(e.target.value)})}
                style={styles.input}
                required
              >
                <option value={0}>선택</option>
                {studioLocations.map(studio => (
                  <option key={studio.id} value={studio.id}>
                    {studio.name}번 스튜디오
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 촬영 형식 */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              촬영 형식 <span style={styles.required}>*</span>
            </label>
            <select 
              value={formData.shooting_type}
              onChange={(e) => setFormData({...formData, shooting_type: e.target.value})}
              style={styles.input}
              required
            >
              {type === 'studio' ? (
                <>
                  <option value="PPT">PPT</option>
                  <option value="일반칠판">일반칠판</option>
                  <option value="전자칠판">전자칠판</option>
                  <option value="크로마키">크로마키</option>
                  <option value="PC와콤">PC와콤</option>
                  <option value="PC">PC</option>
                </>
              ) : (
                <>
                  <option value="촬영">촬영</option>
                  <option value="중계">중계</option>
                  <option value="본사">본사</option>
                  <option value="라이브">라이브</option>
                  <option value="부아">부아</option>
                </>
              )}
            </select>
          </div>

          {/* 강의명, 강의코드 */}
          <div style={styles.formRow}>
            <div>
              <label style={styles.label}>
                {type === 'studio' ? '강의명' : '과목명'} {type === 'academy' && <span style={styles.required}>*</span>}
              </label>
              <input 
                type="text"
                value={formData.course_name}
                onChange={(e) => setFormData({...formData, course_name: e.target.value})}
                style={styles.input}
                placeholder={type === 'studio' ? '강의명을 입력하세요' : '과목명을 입력하세요'}
                required={type === 'academy'}
              />
            </div>
            <div>
              <label style={styles.label}>
                {type === 'studio' ? '강의코드' : '과목 코드'}
              </label>
              <input 
                type="text"
                value={formData.course_code}
                onChange={(e) => setFormData({...formData, course_code: e.target.value})}
                style={styles.input}
                placeholder={type === 'studio' ? '코드' : '과목 코드를 입력하세요'}
              />
            </div>
          </div>

          {/* 전달사항/비고 */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              {type === 'studio' ? '전달사항' : '비고'}
            </label>
            <textarea 
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              style={{
                ...styles.input,
                minHeight: '80px',
                resize: 'vertical' as const
              }}
              placeholder={type === 'studio' ? '특별한 요청사항이나 전달사항을 입력하세요' : '추가 정보나 특이사항을 입력하세요'}
            />
          </div>

          {/* 버튼 */}
          <div style={styles.buttonGroup}>
            {onDelete && (
              <button 
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                style={{
                  ...styles.buttonDanger,
                  background: isLoading ? '#ccc' : '#dc2626'
                }}
              >
                🗑️ 삭제
              </button>
            )}
            
            <button 
              type="submit"
              disabled={isLoading}
              style={{
                ...styles.buttonPrimary,
                background: isLoading ? '#ccc' : '#059669'
              }}
            >
              {isLoading ? '수정 중...' : '✏️ 수정 완료'}
            </button>
            
            <button 
              type="button"
              onClick={onClose}
              style={styles.buttonSecondary}
            >
              취소
            </button>
          </div>
        </div>
      </form>
    </BaseModal>
  );
};
