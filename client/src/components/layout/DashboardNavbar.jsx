
import { Link, useNavigate, useLocation } from "react-router-dom";
import Button from "../ui/Button";
import { clearAuthData } from "../../services/authService";

function DashboardNavbar() {
  const navigate = useNavigate();
  const location = useLocation();

  // Show the navbar only on the main dashboard
  if (location.pathname !== "/dashboard") {
    return null;
  }

  const handleLogout = () => {
    clearAuthData();
    navigate("/login");
  };

  return (
    <header className="dashboard__header">
      <div className="container dashboard__header-inner">
        <Link to="/dashboard" className="dashboard__logo">
          <span className="dashboard__logo-icon">CP</span>
          Placement Portal
        </Link>

        <div className="dashboard__nav-links">
          <Link to="/dashboard">
            <Button size="sm">Dashboard</Button>
          </Link>

          <Link to="/students">
            <Button size="sm">Students</Button>
          </Link>

          <Link to="/companies">
            <Button size="sm">Companies</Button>
          </Link>

          <Link to="/placements">
            <Button size="sm">Placements</Button>
          </Link>

          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}

export default DashboardNavbar;
