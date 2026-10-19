import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import FormInput from '../components/ui/FormInput';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { registerUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { validateRegisterForm } from '../utils/validation';

const initialFormData = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  college: '',
  branch: '',
  year: '',
  role: 'student',
  adminCode: '',
};

function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState(initialFormData);
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

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

    const errors = validateRegisterForm(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const response = await registerUser({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        college: formData.college.trim(),
        branch: formData.role === 'admin' ? undefined : formData.branch.trim(),
        year: formData.role === 'admin' ? undefined : Number(formData.year),
        role: formData.role,
        adminCode: formData.role === 'admin' ? formData.adminCode.trim() : undefined,
      });

      login(response.data.token, response.data.user);
      setSuccessMessage(response.message || 'Registration successful');

      setTimeout(() => {
        navigate('/dashboard');
      }, 800);
    } catch (error) {
      const message =
        error.response?.data?.message || 'Registration failed. Please try again.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create account" subtitle="Register to access Placement Portal">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Alert type="error" message={errorMessage} />
        <Alert type="success" message={successMessage} />

        <FormInput
          label="Full Name"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter your full name"
          error={fieldErrors.name}
          required
          autoComplete="name"
        />

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
          autoComplete="email"
        />

        <FormInput
          label="College"
          id="college"
          name="college"
          value={formData.college}
          onChange={handleChange}
          placeholder="Your college name"
          error={fieldErrors.college}
          required
          autoComplete="organization"
        />

        <FormInput
          label="Role"
          id="role"
          name="role"
        >
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="form-group__input"
          >
            <option value="student">Student</option>
            <option value="admin">Admin</option>
          </select>
        </FormInput>

        {formData.role === 'admin' && (
          <FormInput
            label="Admin Invite Code"
            id="adminCode"
            name="adminCode"
            value={formData.adminCode}
            onChange={handleChange}
            placeholder="Enter the admin invite code"
            error={fieldErrors.adminCode}
            required
          />
        )}

        {formData.role !== 'admin' && (
          <>
            <FormInput
              label="Branch"
              id="branch"
              name="branch"
              value={formData.branch}
              onChange={handleChange}
              placeholder="e.g. Computer Science"
              error={fieldErrors.branch}
              required
            />

            <FormInput
              label="Year"
              id="year"
              name="year"
              error={fieldErrors.year}
              required
            >
              <select
                id="year"
                name="year"
                value={formData.year}
                onChange={handleChange}
                className="form-group__input"
              >
                <option value="">Select year</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </FormInput>
          </>
        )}

        <FormInput
          label="Password"
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Minimum 6 characters"
          error={fieldErrors.password}
          required
          autoComplete="new-password"
        />

        <FormInput
          label="Confirm Password"
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="Re-enter your password"
          error={fieldErrors.confirmPassword}
          required
          autoComplete="new-password"
        />

        <div className="auth-form__submit">
          <Button type="submit" variant="primary" size="md" disabled={loading}>
            {loading ? (
              <>
                <Spinner size="sm" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </div>

        <p className="auth-form__footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default Register;
