import React from 'react';

interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  id?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const Select: React.FC<SelectProps> = ({
  id,
  value,
  onChange,
  options = [],
  placeholder,
  disabled = false,
  error,
  required = false,
  className = '',
  children,
  ...props
}) => {
  return (
    <div className="select-container">
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`select-input ${error ? 'error' : ''} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        
        {/* options가 있을 때만 map 실행 */}
        {options && options.length > 0 && options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
        
        {/* children이 있으면 children 사용 (기존 코드 호환성) */}
        {children}
      </select>
      
      {error && <span className="error-message">{error}</span>}
      
      <style jsx>{`
        .select-container {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .select-input {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          transition: border-color 0.2s ease;
          min-height: 40px;
        }

        .select-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        .select-input.error {
          border-color: #ef4444;
        }

        .select-input:disabled {
          background: #f9fafb;
          color: #6b7280;
          cursor: not-allowed;
        }

        .error-message {
          color: #ef4444;
          font-size: 12px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default Select;
