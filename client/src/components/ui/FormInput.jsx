import { useState } from 'react';
import './FormInput.css';

export function EyeIcon({ className = '', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`form-group__eye-icon ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ className = '', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`form-group__eye-icon ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function FormInput({
  label,
  id,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  required = false,
  autoComplete,
  showPasswordToggle = false,
  isPasswordVisible,
  onTogglePassword,
  toggleAriaLabel,
  children,
  disabled = false,
  ...rest
}) {
  const [internalVisible, setInternalVisible] = useState(false);
  const isControlled = typeof isPasswordVisible === 'boolean';
  const visible = isControlled ? isPasswordVisible : internalVisible;

  const handleToggle = () => {
    if (onTogglePassword) {
      onTogglePassword();
    }
    if (!isControlled) {
      setInternalVisible((prev) => !prev);
    }
  };

  const resolvedType = showPasswordToggle ? (visible ? 'text' : 'password') : type;
  const defaultAriaLabel = visible ? 'Hide password' : 'Show password';

  return (
    <div className={`form-group ${error ? 'form-group--error' : ''}`}>
      <label htmlFor={id} className="form-group__label">
        {label}
        {required && <span className="form-group__required">*</span>}
      </label>
      {children || (
        <div className="form-group__input-wrapper">
          <input
            id={id}
            name={name}
            type={resolvedType}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`form-group__input ${showPasswordToggle ? 'form-group__input--with-toggle' : ''}`}
            autoComplete={autoComplete}
            disabled={disabled}
            {...rest}
          />
          {showPasswordToggle && (
            <button
              type="button"
              className="form-group__toggle-password"
              onClick={handleToggle}
              onMouseDown={(e) => e.preventDefault()}
              aria-label={toggleAriaLabel || defaultAriaLabel}
              aria-pressed={visible}
              title={toggleAriaLabel || defaultAriaLabel}
              tabIndex={0}
              disabled={disabled}
            >
              {visible ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          )}
        </div>
      )}
      {error && <span className="form-group__error">{error}</span>}
    </div>
  );
}

export default FormInput;
