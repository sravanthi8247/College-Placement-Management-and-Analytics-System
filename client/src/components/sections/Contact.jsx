import './Contact.css';

function Contact() {
  return (
    <section id="contact" className="section contact">
      <div className="container">
        <header className="section-header">
          <span className="section-label">Contact</span>
          <h2 className="section-title">Get in Touch</h2>
          <p className="section-description">
            Have questions about Placement Portal? Reach out to our team and
            we will help you get started.
          </p>
        </header>
        <div className="contact__grid">
          <div className="contact__card">
            <span className="contact__icon" aria-hidden="true">
              📧
            </span>
            <h3 className="contact__title">Email</h3>
            <p className="contact__detail">support@placementportal.edu</p>
          </div>
          <div className="contact__card">
            <span className="contact__icon" aria-hidden="true">
              📞
            </span>
            <h3 className="contact__title">Phone</h3>
            <p className="contact__detail">+91 98765 43210</p>
          </div>
          <div className="contact__card">
            <span className="contact__icon" aria-hidden="true">
              📍
            </span>
            <h3 className="contact__title">Address</h3>
            <p className="contact__detail">
              123 Campus Road, Tech Park, Hyderabad, India
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Contact;
