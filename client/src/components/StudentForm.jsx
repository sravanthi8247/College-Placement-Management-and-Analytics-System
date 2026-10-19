import { useState, useEffect } from "react";
import { addStudent } from "../services/studentService";
import "./CompanyForm.css";

const emptyForm = {
  name: "",
  email: "",
  rollNo: "",
  branch: "",
  year: "",
  cgpa: "",
  phone: "",
  skills: "",
  placementStatus: "Not Placed",
};

function StudentForm({
  onStudentAdded,
  selectedStudent,
  onUpdateStudent,
}) {
  const [formData, setFormData] = useState(emptyForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedStudent) {
      setFormData({
        name: selectedStudent.name || "",
        email: selectedStudent.email || "",
        rollNo: selectedStudent.rollNo || "",
        branch: selectedStudent.branch || "",
        year: selectedStudent.year || "",
        cgpa: selectedStudent.cgpa ?? "",
        phone: selectedStudent.phone || "",
        skills: (selectedStudent.skills || []).join(", "),
        placementStatus: selectedStudent.placementStatus || "Not Placed",
      });
    } else {
      setFormData(emptyForm);
    }
    setErrorMessage("");
  }, [selectedStudent]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const cgpa = Number(formData.cgpa);
    const year = Number(formData.year);

    if (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
      setErrorMessage("CGPA must be between 0 and 10.");
      return;
    }

    if (Number.isNaN(year) || year < 1 || year > 4) {
      setErrorMessage("Year must be between 1 and 4.");
      return;
    }

    const payload = {
      ...formData,
      year,
      cgpa,
      name: formData.name.trim(),
      email: formData.email.trim(),
      rollNo: formData.rollNo.trim(),
      branch: formData.branch.trim(),
      phone: formData.phone.trim(),
      skills: formData.skills,
    };

    setSaving(true);

    try {
      if (selectedStudent) {
        await onUpdateStudent(payload);
      } else {
        await addStudent(payload);
      }

      setFormData(emptyForm);
      onStudentAdded();
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

      <label>
        Full name *
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Email *
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Roll number *
        <input
          type="text"
          name="rollNo"
          value={formData.rollNo}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Branch *
        <input
          type="text"
          name="branch"
          value={formData.branch}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Year *
        <select name="year" value={formData.year} onChange={handleChange} required>
          <option value="">Select year</option>
          <option value="1">1st Year</option>
          <option value="2">2nd Year</option>
          <option value="3">3rd Year</option>
          <option value="4">4th Year</option>
        </select>
      </label>

      <label>
        CGPA *
        <input
          type="number"
          step="0.01"
          min="0"
          max="10"
          name="cgpa"
          value={formData.cgpa}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Phone *
        <input
          type="text"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Skills
        <input
          type="text"
          name="skills"
          placeholder="Java, SQL, React"
          value={formData.skills}
          onChange={handleChange}
        />
      </label>

      <label>
        Placement status
        <select
          name="placementStatus"
          value={formData.placementStatus}
          onChange={handleChange}
        >
          <option value="Not Placed">Not Placed</option>
          <option value="Placed">Placed</option>
        </select>
      </label>

      <button type="submit" disabled={saving}>
        {saving
          ? "Saving..."
          : selectedStudent
            ? "Update Student"
            : "Save Student"}
      </button>
    </form>
  );
}

export default StudentForm;
