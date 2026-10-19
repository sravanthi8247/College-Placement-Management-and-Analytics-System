import './About.css';

function About() {
  return (
    <section id="about" className="section about">
      <div className="container about__inner">
        <div className="about__content">
          <span className="section-label">About Us</span>
          <h2 className="section-title about__title">
            Built for Modern Campus Recruitment
          </h2>
          <p className="about__text">
            Placement Portal helps educational institutions digitize their
            entire placement workflow. From registering students and publishing company
            drives to tracking interviews and publishing final results, our platform
            reduces manual effort and improves transparency.
          </p>
          <p className="about__text">
            Trusted by placement cells across engineering and management colleges, we
            focus on reliability, ease of use, and actionable insights that support
            better career outcomes for every student.
          </p>
        </div>
        <div className="about__visual">
          <div className="about__card">
            <h3 className="about__card-title">Our Mission</h3>
            <p className="about__card-text">
              Empower colleges with technology that simplifies placements and connects
              talented students with the right opportunities.
            </p>
          </div>
          <div className="about__card about__card--accent">
            <h3 className="about__card-title">Why Choose Us?</h3>
            <ul className="about__list">
              <li>Secure & role-based access</li>
              <li>Real-time placement tracking</li>
              <li>Dedicated support for coordinators</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export default About;
