import './Footer.css';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <div className="footer__logo">
            <span className="footer__logo-icon">PP</span>
            <span>Placement Portal</span>
          </div>
          <p className="footer__tagline">
            Simplifying campus placements for colleges, coordinators, and students.
          </p>
        </div>

        <div className="footer__column">
          <h4 className="footer__heading">Quick Links</h4>
          <ul className="footer__links">
            <li><a href="#home">Home</a></li>
            <li><a href="#features">Features</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </div>

        <div className="footer__column">
          <h4 className="footer__heading">Contact Info</h4>
          <ul className="footer__contact">
            <li>support@placementtracker.com</li>
            <li>+91 98765 43210</li>
            <li>123 Campus Road, Tech Park</li>
            <li>Hyderabad, India</li>
          </ul>
        </div>
      </div>

      <div className="footer__bottom">
        <div className="container">
          <p>&copy; {currentYear} Placement Portal. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
