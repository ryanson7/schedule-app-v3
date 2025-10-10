import React from 'react';

interface InputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  type?: 'text' | 'email' | 'password' | 'date' | 'number';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, value, onChange, placeholder, required, disabled, error, type = 'text' }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    };

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          value={value || ''}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          style={{
            padding: '10px 12px',
            border: `1px solid ${error ? '#ef4444' : '#d1d5db'}`,
            borderRadius: '6px',
            fontSize: '14px',
            width: '100%'
          }}
        />
        {error && (
          <span className="text-xs text-red-500">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
