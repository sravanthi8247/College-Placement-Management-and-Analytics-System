import { useState, useEffect, useRef, useCallback } from 'react';
import { getStudents } from '../services/studentService';
import './StudentSearchSelector.css';

/**
 * Searchable & Paginated Student Selector Component for Placement Form
 *
 * Requirements:
 * - Search by student name, roll number, and branch.
 * - Search works reliably with:
 *   * Single letter (e.g. 's')
 *   * Single number (e.g. '1')
 *   * Multiple characters (e.g. 'sr')
 *   * Full student name or roll number
 * - Typing never gets wiped or reset by incoming API responses.
 * - Clicking a student populates the selection field with the student's name and roll number.
 * - Stores and submits the correct MongoDB student _id.
 * - Selected student remains visible after choosing a result.
 * - Supports editing a placement with pre-selected student.
 * - Provides clear button to change or remove selection.
 */
function StudentSearchSelector({
  value = '',
  onChange,
  selectedStudent = null,
  initialStudents = [],
  required = true,
  disabled = false,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 25;
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedStudentObj, setSelectedStudentObj] = useState(null);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const latestRequestIdRef = useRef(0);
  const prevValueRef = useRef(value);

  // Sync selectedStudent from prop (e.g. when editing a placement)
  useEffect(() => {
    if (selectedStudent && typeof selectedStudent === 'object' && selectedStudent._id) {
      setSelectedStudentObj(selectedStudent);
      setSearchTerm(`${selectedStudent.name} (${selectedStudent.rollNo})`);
      prevValueRef.current = selectedStudent._id;
    }
  }, [selectedStudent]);

  // Synchronize external value prop changes (e.g. parent resets form or cancels edit)
  // CRITICAL FIX: Do NOT include options in dependencies or wipe searchTerm while user is typing.
  useEffect(() => {
    if (value === prevValueRef.current && selectedStudentObj?._id === value) {
      return;
    }
    prevValueRef.current = value;

    if (!value) {
      setSelectedStudentObj(null);
      setSearchTerm('');
      return;
    }

    if (selectedStudent && typeof selectedStudent === 'object' && selectedStudent._id === value) {
      setSelectedStudentObj(selectedStudent);
      setSearchTerm(`${selectedStudent.name} (${selectedStudent.rollNo})`);
      return;
    }

    const foundInInitial = Array.isArray(initialStudents)
      ? initialStudents.find((s) => s._id === value)
      : null;
    if (foundInInitial) {
      setSelectedStudentObj(foundInInitial);
      setSearchTerm(`${foundInInitial.name} (${foundInInitial.rollNo})`);
      return;
    }

    const foundInOptions = options.find((s) => s._id === value);
    if (foundInOptions) {
      setSelectedStudentObj(foundInOptions);
      setSearchTerm(`${foundInOptions.name} (${foundInOptions.rollNo})`);
    }
  }, [value, selectedStudent, initialStudents]);

  // Click outside listener & Escape key listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        // If a student is currently selected, restore display name in input
        if (selectedStudentObj) {
          setSearchTerm(`${selectedStudentObj.name} (${selectedStudentObj.rollNo})`);
        }
      }
    };

    const handleKeyDownOutside = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        if (selectedStudentObj) {
          setSearchTerm(`${selectedStudentObj.name} (${selectedStudentObj.rollNo})`);
        }
        inputRef.current?.blur();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDownOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDownOutside);
    };
  }, [isOpen, selectedStudentObj]);

  // Cleanup pending search timeouts on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Fetch students function with pagination, search, and race condition protection
  const fetchStudentsList = useCallback(
    async (queryText = '', targetPage = 1) => {
      const requestId = ++latestRequestIdRef.current;
      setLoading(true);
      setFetchError('');

      try {
        const trimmed = String(queryText ?? '').trim();
        const params = {
          page: targetPage,
          limit,
        };

        // Only pass search query if it doesn't match the selected student's display name exactly
        if (
          trimmed &&
          !(
            selectedStudentObj &&
            trimmed === `${selectedStudentObj.name} (${selectedStudentObj.rollNo})`
          )
        ) {
          params.search = trimmed;
        }

        const res = await getStudents(params);

        // Ignore response if a newer request has been made
        if (requestId !== latestRequestIdRef.current) {
          return;
        }

        if (res && typeof res === 'object' && Array.isArray(res.students)) {
          setOptions(res.students);
          setTotalCount(res.total || 0);
          setTotalPages(res.totalPages || 1);
        } else if (Array.isArray(res)) {
          const filterQuery =
            trimmed &&
            !(
              selectedStudentObj &&
              trimmed === `${selectedStudentObj.name} (${selectedStudentObj.rollNo})`
            )
              ? trimmed.toLowerCase()
              : '';

          const filtered = res.filter((s) => {
            if (!filterQuery) return true;
            return [s.name, s.rollNo, s.branch, s.email].some((val) =>
              String(val || '').toLowerCase().includes(filterQuery)
            );
          });
          const start = (targetPage - 1) * limit;
          setOptions(filtered.slice(start, start + limit));
          setTotalCount(filtered.length);
          setTotalPages(Math.max(1, Math.ceil(filtered.length / limit)));
        }
      } catch (err) {
        if (requestId === latestRequestIdRef.current) {
          console.error('Error fetching students for selector:', err);
          setFetchError('Unable to load students. Please try again.');
        }
      } finally {
        if (requestId === latestRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [limit, selectedStudentObj]
  );

  // Handle typing in the search/selection input
  const handleSearchChange = (e) => {
    const text = e.target.value;
    setSearchTerm(text);
    setPage(1);
    if (!isOpen) setIsOpen(true);
    setHighlightedIndex(0);

    // If user is typing something different from current selected student, clear selection
    if (selectedStudentObj) {
      const selectedDisplay = `${selectedStudentObj.name} (${selectedStudentObj.rollNo})`;
      if (text.trim() !== selectedDisplay) {
        setSelectedStudentObj(null);
        prevValueRef.current = '';
        onChange('', null);
      }
    } else if (!text.trim() && value) {
      prevValueRef.current = '';
      onChange('', null);
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchStudentsList(text, 1);
    }, 250);
  };

  const handleSelect = (student) => {
    if (!student?._id) return;
    setSelectedStudentObj(student);
    const display = `${student.name} (${student.rollNo})`;
    setSearchTerm(display);
    prevValueRef.current = student._id;
    onChange(student._id, student);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedStudentObj(null);
    setSearchTerm('');
    prevValueRef.current = '';
    onChange('', null);
    setPage(1);
    setIsOpen(true);
    fetchStudentsList('', 1);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    const query =
      selectedStudentObj &&
      searchTerm === `${selectedStudentObj.name} (${selectedStudentObj.rollNo})`
        ? ''
        : searchTerm;
    fetchStudentsList(query, newPage);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      // Prevent form submission on Enter in search box
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < options.length) {
        handleSelect(options[highlightedIndex]);
      } else if (!isOpen) {
        setIsOpen(true);
      }
      return;
    }

    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    }
  };

  return (
    <div className="student-selector-container" ref={containerRef}>
      {/* Hidden input to bind native form validation and submission with student MongoDB _id */}
      <input
        type="hidden"
        name="student"
        value={value || ''}
        required={required}
      />

      <div className="student-selector-input-wrapper">
        <span className="student-selector-icon" aria-hidden="true">⌕</span>
        <input
          ref={inputRef}
          type="text"
          className="student-selector-input"
          placeholder="Search student by name, roll number, or branch..."
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={() => {
            setIsOpen(true);
            if (options.length === 0) {
              const query = (selectedStudentObj && searchTerm === `${selectedStudentObj.name} (${selectedStudentObj.rollNo})`)
                ? ''
                : searchTerm;
              fetchStudentsList(query, page);
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label="Student name and roll number"
          autoComplete="off"
        />
        {(searchTerm || selectedStudentObj) && (
          <button
            type="button"
            className="student-selector-clear-icon"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Clear selected student"
            title="Clear selection"
          >
            ✕
          </button>
        )}
      </div>

      {/* Selected Student Meta Info Bar */}
      {selectedStudentObj && (
        <div className="student-selector-selected-box" style={{ marginTop: 6 }}>
          <div className="student-selector-selected-details">
            <span className="student-selector-selected-name">
              ✓ {selectedStudentObj.name}
            </span>
            <div className="student-selector-selected-meta">
              <span className="student-selector-badge">
                Roll: {selectedStudentObj.rollNo}
              </span>
              <span className="student-selector-badge">
                Branch: {selectedStudentObj.branch || 'N/A'}
              </span>
              {selectedStudentObj.cgpa !== undefined && (
                <span>CGPA: {selectedStudentObj.cgpa}</span>
              )}
              {selectedStudentObj.placementStatus && (
                <span
                  className={`student-selector-status-badge ${
                    selectedStudentObj.placementStatus === 'Placed'
                      ? 'student-selector-status-placed'
                      : 'student-selector-status-notplaced'
                  }`}
                >
                  {selectedStudentObj.placementStatus}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="student-selector-clear-btn"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Change selected student"
          >
            Change
          </button>
        </div>
      )}

      {isOpen && (
        <div className="student-selector-dropdown">
          {fetchError && (
            <div className="student-selector-error" role="alert">
              <span>{fetchError}</span>
              <button
                type="button"
                className="student-selector-retry-btn"
                onClick={() => {
                  const query = (selectedStudentObj && searchTerm === `${selectedStudentObj.name} (${selectedStudentObj.rollNo})`)
                    ? ''
                    : searchTerm;
                  fetchStudentsList(query, page);
                }}
              >
                ↻ Retry
              </button>
            </div>
          )}

          {loading && (
            <div className="student-selector-loading">
              <span className="refresh-icon spinning" aria-hidden="true">↻</span> Searching students...
            </div>
          )}

          {!loading && !fetchError && options.length === 0 && (
            <div className="student-selector-empty">
              <strong>No students match &ldquo;{searchTerm.trim()}&rdquo;</strong>
              <span>Try searching with a different name, roll number, or branch</span>
            </div>
          )}

          {!loading && !fetchError && options.length > 0 && (
            <ul role="listbox" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {options.map((student, idx) => {
                const isSelected = student._id === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <li
                    key={student._id}
                    role="option"
                    aria-selected={isSelected}
                    className={`student-selector-item ${isSelected ? 'selected' : ''} ${
                      isHighlighted ? 'highlighted' : ''
                    }`}
                    onClick={() => handleSelect(student)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    <div className="student-selector-item-content">
                      <span className="student-selector-item-name">{student.name}</span>
                      <div className="student-selector-item-meta">
                        <span className="student-selector-badge">Roll: {student.rollNo}</span>
                        <span className="student-selector-badge">Branch: {student.branch}</span>
                        {student.cgpa !== undefined && <span>CGPA: {student.cgpa}</span>}
                        {student.year && <span>Year {student.year}</span>}
                      </div>
                    </div>
                    {student.placementStatus && (
                      <span
                        className={`student-selector-status-badge ${
                          student.placementStatus === 'Placed'
                            ? 'student-selector-status-placed'
                            : 'student-selector-status-notplaced'
                        }`}
                      >
                        {student.placementStatus}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Pagination Controls in Dropdown Footer */}
          {totalPages > 1 && !loading && (
            <div className="student-selector-pagination">
              <button
                type="button"
                className="student-selector-page-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePageChange(Math.max(1, page - 1));
                }}
                disabled={page <= 1}
                aria-label="Previous page of students"
              >
                ‹ Prev
              </button>
              <span className="student-selector-page-text">
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <button
                type="button"
                className="student-selector-page-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePageChange(Math.min(totalPages, page + 1));
                }}
                disabled={page >= totalPages}
                aria-label="Next page of students"
              >
                Next ›
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StudentSearchSelector;
