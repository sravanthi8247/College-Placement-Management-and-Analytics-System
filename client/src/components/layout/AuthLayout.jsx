
import './AuthLayout.css';

function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="auth-page">
      <section className="auth-page__brand">
        <div className="auth-page__brand-content">
          <div className="auth-page__logo">
            <span className="auth-page__logo-icon">
              <span>CP</span>
            </span>
            <span className="auth-page__brand-name">
              Placement Portal
            </span>
          </div>

          <div className="auth-page__intro">
            <span className="auth-page__eyebrow">
              COLLEGE PLACEMENT MANAGEMENT
            </span>

            <h1>
              Your next opportunity
              <br />
              starts here.
            </h1>

            <p>
              Access placement drives, manage applications, and
              track placement progress through one centralized
              college placement platform.
            </p>
          </div>

          <div className="auth-page__brand-footer">
            A centralized platform for campus placements
          </div>
        </div>
      </section>

      <main className="auth-page__form-panel">
        <div className="auth-page__form-wrapper">
          <div className="auth-page__form-header">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;
