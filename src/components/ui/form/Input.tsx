import React from 'react';

interface InputProps {
  id?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel';
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
  min?: string | number;
  max?: string | number;
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const Input: React.FC<InputProps> = ({
  id,
  type = 'text',
  value = '',
  onChange,
  placeholder,
  disabled = false,
  required = false,
  error,
  className = '',
  min,
  max,
  onKeyPress,
  ...props
}) => {
  // 안전한 이벤트 핸들러
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange && e.target) {
      onChange(e);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (onKeyPress) {
      onKeyPress(e);
    }
  };

  return (
    <div className="input-container">
      <input
        id={id}
        type={type}
        value={value}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        className={`input-field ${error ? 'error' : ''} ${className}`}
        {...props}
      />
      
      {error && <span className="error-text">{error}</span>}
      
      <style jsx>{`
        .input-container {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .input-field {
          padding: 12px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          background: white;
          transition: all 0.2s ease;
          outline: none;
        }

        .input-field:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .input-field.error {
          border-color: #ef4444;
        }

        .input-field.error:focus {
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }

        .input-field:disabled {
          background: #f9fafb;
          color: #6b7280;
          cursor: not-allowed;
        }

        .error-text {
          color: #ef4444;
          font-size: 12px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default Input;
