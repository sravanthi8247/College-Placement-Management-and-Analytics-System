import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import FormInput from '../components/ui/FormInput';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { loginUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { validateLoginForm } from '../utils/validation';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const errors = validateLoginForm(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const response = await loginUser({
        email: formData.email.trim(),
        password: formData.password,
      });

      login(response.data.token, response.data.user);
      setSuccessMessage(response.message || 'Login successful');

      setTimeout(() => {
        navigate('/dashboard');
      }, 800);
    } catch (error) {
      const message =
        error.response?.data?.message || 'Login failed. Please try again.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your account to continue">
      <form className="auth-form" onSubmit={handleSubmit} noValidate autoComplete="off">
        <Alert type="error" message={errorMessage} />
        <Alert type="success" message={successMessage} />

        <FormInput
          label="Email"
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="you@gmail.com"
          error={fieldErrors.email}
          required
          autoComplete="off"
        />

        <FormInput
          label="Password"
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          value={formData.password}
          onChange={handleChange}
          placeholder="Enter your password"
          error={fieldErrors.password}
          required
          autoComplete="off"
          showPasswordToggle
          isPasswordVisible={showPassword}
          onTogglePassword={() => setShowPassword((prev) => !prev)}
          toggleAriaLabel={showPassword ? 'Hide password' : 'Show password'}
        />

        <div className="auth-form__submit">
          <Button type="submit" variant="primary" size="md" disabled={loading}>
            {loading ? (
              <>
                <Spinner size="sm" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </div>

        <p className="auth-form__footer">
          Don&apos;t have an account? <Link to="/register">Create one</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default Login;
