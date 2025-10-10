"use client";
import { forwardRef, useMemo } from "react";

interface TimeInputProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  minTime?: string; // "07:00" 형식
  maxTime?: string; // "22:00" 형식
  step?: number; // 분 단위 (기본 10분)
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const TimeInput = forwardRef<HTMLSelectElement, TimeInputProps>(({
  label,
  value = '',
  onChange,
  onBlur,
  disabled = false,
  required = false,
  error,
  minTime = '07:00',
  maxTime = '22:00',
  step = 10,
  size = 'md',
  fullWidth = true
}, ref) => {
  // 시간 옵션 생성 (07:00 ~ 22:00, 10분 단위)
  const timeOptions = useMemo(() => {
    const options = [];
    const [minHour, minMinute] = minTime.split(':').map(Number);
    const [maxHour, maxMinute] = maxTime.split(':').map(Number);
    
    const startMinutes = minHour * 60 + minMinute;
    const endMinutes = maxHour * 60 + maxMinute;
    
    for (let minutes = startMinutes; minutes <= endMinutes; minutes += step) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      options.push({
        value: timeString,
        label: timeString
      });
    }
    
    return options;
  }, [minTime, maxTime, step]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange?.(e.target.value);
  };

  return (
    <div className={`time-input-wrapper ${fullWidth ? 'full-width' : ''}`}>
      {label && (
        <label className="time-label">
          {label}
          {required && <span className="required-mark">*</span>}
        </label>
      )}
      
      <div className="time-container">
        <select
          ref={ref}
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          className={`time-field time-${size} ${error ? 'error' : ''}`}
        >
          <option value="" disabled>
            시간 선택
          </option>
          {timeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="time-arrow">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      
      {error && <span className="error-message">{error}</span>}

      <style jsx>{`
        .time-input-wrapper {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .full-width {
          width: 100%;
        }

        .time-label {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .required-mark {
          color: #dc2626;
          font-weight: 700;
        }

        .time-container {
          position: relative;
        }

        .time-field {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #ffffff;
          color: #1f2937;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
          transition: all 0.2s ease;
          width: 100%;
          appearance: none;
          cursor: pointer;
        }

        .time-field:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .time-field:disabled {
          background: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .time-field.error {
          border-color: #dc2626;
        }

        .time-field.error:focus {
          border-color: #dc2626;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
        }

        .time-sm {
          padding: 8px 32px 8px 12px;
          font-size: 14px;
          min-height: 36px;
        }

        .time-md {
          padding: 10px 36px 10px 14px;
          font-size: 16px;
          min-height: 44px;
        }

         .time-lg {
          padding: 12px 40px 12px 16px;
          font-size: 18px;
          min-height: 52px;
        }

        .time-arrow {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: #6b7280;
        }

        .time-field:disabled + .time-arrow {
          color: #d1d5db;
        }

        .error-message {
          font-size: 12px;
          color: #dc2626;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
});

TimeInput.displayName = 'TimeInput';

export default TimeInput;
