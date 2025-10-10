"use client";
import { forwardRef } from "react";

interface TextAreaProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  rows?: number;
  maxLength?: number;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({
  label,
  placeholder,
  value = '',
  onChange,
  onBlur,
  disabled = false,
  required = false,
  error,
  rows = 4,
  maxLength,
  size = 'md',
  fullWidth = true,
  resize = 'vertical'
}, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e.target.value);
  };

  return (
    <div className={`textarea-wrapper ${fullWidth ? 'full-width' : ''}`}>
      {label && (
        <label className="textarea-label">
          {label}
          {required && <span className="required-mark">*</span>}
        </label>
      )}
      
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={rows}
        maxLength={maxLength}
        className={`textarea-field textarea-${size} ${error ? 'error' : ''}`}
        style={{ resize }}
      />
      
      <div className="textarea-footer">
        {error && <span className="error-message">{error}</span>}
        {maxLength && (
          <span className="char-count">
            {value.length}/{maxLength}
          </span>
        )}
      </div>

      <style jsx>{`
        .textarea-wrapper {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .full-width {
          width: 100%;
        }

        .textarea-label {
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

        .textarea-field {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #ffffff;
          color: #1f2937;
          font-family: inherit;
          transition: all 0.2s ease;
          width: 100%;
          line-height: 1.5;
        }

        .textarea-field:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .textarea-field:disabled {
          background: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .textarea-field.error {
          border-color: #dc2626;
        }

        .textarea-field.error:focus {
          border-color: #dc2626;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
        }

        .textarea-sm {
          padding: 8px 12px;
          font-size: 14px;
        }

        .textarea-md {
          padding: 10px 14px;
          font-size: 16px;
        }

        .textarea-lg {
          padding: 12px 16px;
          font-size: 18px;
        }

        .textarea-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          min-height: 16px;
        }

        .error-message {
          font-size: 12px;
          color: #dc2626;
        }

        .char-count {
          font-size: 12px;
          color: #6b7280;
          margin-left: auto;
        }
      `}</style>
    </div>
  );
});

TextArea.displayName = 'TextArea';

export default TextArea;
