import React from 'react';

interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  label?: string;
  value: string | number;
  onChange: (value: string | number) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, value, onChange, options, placeholder, required, disabled, error }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedValue = e.target.value;
      // 숫자로 변환 가능하면 숫자로, 아니면 문자열로
      const parsedValue = isNaN(Number(selectedValue)) ? selectedValue : Number(selectedValue);
      onChange(parsedValue);
    };

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          value={value || ''}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          style={{
            padding: '10px 12px',
            border: `1px solid ${error ? '#ef4444' : '#d1d5db'}`,
            borderRadius: '6px',
            fontSize: '14px',
            width: '100%',
            backgroundColor: 'white'
          }}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <span className="text-xs text-red-500">{error}</span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
