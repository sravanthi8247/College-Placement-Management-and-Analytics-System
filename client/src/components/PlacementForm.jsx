import { useState, useEffect } from "react";
import { addPlacement } from "../services/placementService";
import { getStudents } from "../services/studentService";
import { getCompanies } from "../services/companyService";
import StudentSearchSelector from "./StudentSearchSelector";
import "./CompanyForm.css";

function PlacementForm({
  onPlacementAdded,
  selectedPlacement,
  onUpdatePlacement,
}) {
  const [students, setStudents] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    student: "",
    company: "",
    placementDate: "",
    packageOffered: "",
    status: "Pending",
  });

  const loadData = async () => {
    try {
      const [studentsData, companiesData] = await Promise.all([
        getStudents(),
        getCompanies(),
      ]);
      setStudents(
        Array.isArray(studentsData)
          ? studentsData
          : Array.isArray(studentsData?.students)
          ? studentsData.students
          : []
      );
      setCompanies(Array.isArray(companiesData) ? companiesData : []);
    } catch (error) {
      setErrorMessage("Unable to load students or companies.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedPlacement) {
      setFormData({
        student: selectedPlacement.student?._id || selectedPlacement.student || "",
        company: selectedPlacement.company?._id || selectedPlacement.company || "",
        placementDate: selectedPlacement.placementDate
          ? String(selectedPlacement.placementDate).substring(0, 10)
          : "",
        packageOffered: selectedPlacement.packageOffered ?? "",
        status: selectedPlacement.status || "Pending",
      });
    } else {
      setFormData({
        student: "",
        company: "",
        placementDate: "",
        packageOffered: "",
        status: "Pending",
      });
    }
  }, [selectedPlacement]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!formData.student || !String(formData.student).trim()) {
      setErrorMessage("Please select a student.");
      return;
    }

    if (!formData.company || !String(formData.company).trim()) {
      setErrorMessage("Please select a company.");
      return;
    }

    if (!formData.placementDate) {
      setErrorMessage("Please provide a placement date.");
      return;
    }

    if (formData.packageOffered === "" || formData.packageOffered === undefined) {
      setErrorMessage("Please enter the package offered.");
      return;
    }

    const packageValue = Number(formData.packageOffered);
    if (Number.isNaN(packageValue) || packageValue < 0) {
      setErrorMessage("Package cannot be negative.");
      return;
    }

    setSaving(true);

    try {
      if (selectedPlacement) {
        await onUpdatePlacement(formData);
      } else {
        await addPlacement(formData);
      }

      setFormData({
        student: "",
        company: "",
        placementDate: "",
        packageOffered: "",
        status: "Pending",
      });

      onPlacementAdded();
      await loadData();
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Operation failed. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="company-drive-form" onSubmit={handleSubmit}>
      {errorMessage && (
        <p role="alert" className="company-drive-form__error">
          {errorMessage}
        </p>
      )}

      <div className="company-drive-form__field">
        <span className="company-drive-form__label">Student *</span>
        <StudentSearchSelector
          value={formData.student}
          onChange={(studentId) =>
            setFormData((prev) => ({ ...prev, student: studentId }))
          }
          selectedStudent={selectedPlacement?.student}
          initialStudents={students}
          required
        />
      </div>

      <label>
        Company *
        <select
          name="company"
          value={formData.company}
          onChange={handleChange}
          required
        >
          <option value="">Select Company</option>
          {companies.map((company) => (
            <option key={company._id} value={company._id}>
              {company.companyName}
            </option>
          ))}
        </select>
      </label>

      <label>
        Placement date *
        <input
          type="date"
          name="placementDate"
          value={formData.placementDate}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Package (LPA) *
        <input
          type="number"
          min="0"
          step="0.01"
          name="packageOffered"
          value={formData.packageOffered}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Status
        <select name="status" value={formData.status} onChange={handleChange}>
          <option value="Pending">Pending</option>
          <option value="Selected">Selected</option>
          <option value="Rejected">Rejected</option>
        </select>
      </label>

      <button type="submit" disabled={saving}>
        {saving
          ? "Saving..."
          : selectedPlacement
            ? "Update Placement"
            : "Save Placement"}
      </button>
    </form>
  );
}

export default PlacementForm;
