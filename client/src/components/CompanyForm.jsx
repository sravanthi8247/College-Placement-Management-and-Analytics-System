import "./CompanyForm.css";
import { useState, useEffect } from "react";
import { addCompany } from "../services/companyService";

const initialFormData = {
  companyName: "",
  packageOffered: "",
  location: "",
  jobRole: "",
  eligibilityCGPA: "",
  driveDate: "",
  eligibleBranches: [],
  eligibleYears: [],
  requiredSkills: [],
  applicationDeadline: "",
  description: "",
  driveStatus: "Open",
};

const branches = ["CSE", "IT", "ECE", "EEE", "Mechanical", "Civil"];
const academicYears = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

function toDateInput(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function CompanyForm({ onCompanyAdded, selectedCompany, onUpdateCompany }) {
  const [formData, setFormData] = useState(initialFormData);
  const [skillsText, setSkillsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (selectedCompany) {
      setFormData({
        ...initialFormData,
        ...selectedCompany,
        packageOffered: selectedCompany.packageOffered ?? "",
        eligibilityCGPA: selectedCompany.eligibilityCGPA ?? "",
        driveDate: toDateInput(selectedCompany.driveDate),
        applicationDeadline: toDateInput(
          selectedCompany.applicationDeadline
        ),
        eligibleBranches: selectedCompany.eligibleBranches || [],
        eligibleYears: selectedCompany.eligibleYears || [],
        requiredSkills: selectedCompany.requiredSkills || [],
        driveStatus: selectedCompany.driveStatus || "Open",
      });

      setSkillsText((selectedCompany.requiredSkills || []).join(", "));
    } else {
      setFormData(initialFormData);
      setSkillsText("");
    }

    setErrorMessage("");
  }, [selectedCompany]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleMultiSelect = (event, field) => {
    const selectedValues = Array.from(
      event.target.selectedOptions,
      (option) => option.value
    );

    setFormData((previous) => ({
      ...previous,
      [field]: selectedValues,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    const cgpa = Number(formData.eligibilityCGPA);
    const packageValue = Number(formData.packageOffered);

    if (cgpa < 0 || cgpa > 10) {
      setErrorMessage("Eligibility CGPA must be between 0 and 10.");
      return;
    }

    if (packageValue < 0) {
      setErrorMessage("Package cannot be negative.");
      return;
    }

    if (
      formData.applicationDeadline &&
      formData.driveDate &&
      formData.applicationDeadline > formData.driveDate
    ) {
      setErrorMessage("Application deadline must not be after the drive date.");
      return;
    }

    const payload = {
      ...formData,
      companyName: formData.companyName.trim(),
      location: formData.location.trim(),
      jobRole: formData.jobRole.trim(),
      packageOffered: packageValue,
      eligibilityCGPA: cgpa,
      eligibleBranches: formData.eligibleBranches,
      eligibleYears: formData.eligibleYears,
      requiredSkills: skillsText
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
      applicationDeadline: formData.applicationDeadline || null,
      description: formData.description.trim(),
    };

    setSaving(true);

    try {
      if (selectedCompany) {
        await onUpdateCompany(payload);
      } else {
        await addCompany(payload);
      }

      setFormData(initialFormData);
      setSkillsText("");
      onCompanyAdded();
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Could not save the placement drive. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="company-drive-form" onSubmit={handleSubmit}>
      <h2>
        {selectedCompany ? "Edit Placement Drive" : "Add Placement Drive"}
      </h2>

      {errorMessage && (
        <p role="alert" className="company-drive-form__error">
          {errorMessage}
        </p>
      )}

      <label>
        Company Name *
        <input
          name="companyName"
          value={formData.companyName}
          onChange={handleChange}
          placeholder="Enter company name"
          required
        />
      </label>

      <label>
        Job Role *
        <input
          name="jobRole"
          value={formData.jobRole}
          onChange={handleChange}
          placeholder="e.g. Software Developer"
          required
        />
      </label>

      <label>
        Package Offered (LPA) *
        <input
          type="number"
          name="packageOffered"
          min="0"
          step="0.01"
          value={formData.packageOffered}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Location *
        <input
          name="location"
          value={formData.location}
          onChange={handleChange}
          placeholder="e.g. Hyderabad"
          required
        />
      </label>

      <label>
        Minimum CGPA *
        <input
          type="number"
          name="eligibilityCGPA"
          min="0"
          max="10"
          step="0.01"
          value={formData.eligibilityCGPA}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Drive Date *
        <input
          type="date"
          name="driveDate"
          value={formData.driveDate}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Eligible Branches
        <select
          multiple
          value={formData.eligibleBranches}
          onChange={(event) => handleMultiSelect(event, "eligibleBranches")}
        >
          {branches.map((branch) => (
            <option key={branch} value={branch}>
              {branch}
            </option>
          ))}
        </select>
        <small>Hold Ctrl (Windows) to select multiple branches. Leave empty for all branches.</small>
      </label>

      <label>
        Eligible Academic Years
        <select
          multiple
          value={formData.eligibleYears}
          onChange={(event) => handleMultiSelect(event, "eligibleYears")}
        >
          {academicYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <small>Leave empty for all years.</small>
      </label>

      <label>
        Required Skills
        <input
          value={skillsText}
          onChange={(event) => setSkillsText(event.target.value)}
          placeholder="Java, SQL, React"
        />
        <small>Separate skills with commas.</small>
      </label>

      <label>
        Application Deadline
        <input
          type="date"
          name="applicationDeadline"
          value={formData.applicationDeadline}
          onChange={handleChange}
        />
      </label>

      <label>
        Drive Status
        <select
          name="driveStatus"
          value={formData.driveStatus}
          onChange={handleChange}
        >
          <option value="Open">Open</option>
          <option value="Closed">Closed</option>
          <option value="Completed">Completed</option>
        </select>
      </label>

      <label className="company-drive-form__full">
        Drive Description
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Additional information about this drive"
          rows={3}
        />
      </label>

      <button type="submit" disabled={saving}>
        {saving
          ? "Saving..."
          : selectedCompany
            ? "Update Placement Drive"
            : "Save Placement Drive"}
      </button>
    </form>
  );
}

export default CompanyForm;
