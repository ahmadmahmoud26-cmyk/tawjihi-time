import { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/curriculum.css';

export default function CurriculumPage() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const response = await axios.get('/api/subjects?perPage=20');
      setSubjects(response.data.subjects);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load subjects');
      setLoading(false);
    }
  };

  const fetchUnits = async (subjectId) => {
    try {
      const response = await axios.get(`/api/subjects/${subjectId}/units`);
      setUnits(response.data.units);
      setSelectedSubject(subjectId);
      setSelectedUnit(null);
      setLessons([]);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load units');
    }
  };

  const fetchLessons = async (unitId) => {
    try {
      const response = await axios.get(`/api/subjects/units/${unitId}/lessons`);
      setLessons(response.data.lessons);
      setSelectedUnit(unitId);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load lessons');
    }
  };

  if (loading) return <div className="curriculum-loading">Loading curriculum...</div>;

  return (
    <div className="curriculum-container">
      <header className="page-header">
        <h1>Curriculum</h1>
        <p>Browse subjects, units, and lessons</p>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="curriculum-layout">
        {/* Subjects Column */}
        <div className="curriculum-column">
          <h2>Subjects</h2>
          <div className="list">
            {subjects.map(subject => (
              <div
                key={subject.id}
                className={`list-item ${selectedSubject === subject.id ? 'active' : ''}`}
                onClick={() => fetchUnits(subject.id)}
              >
                <div className="list-item-content">
                  <h4>{subject.name}</h4>
                  <p className="list-item-meta">{subject.total_units || 0} units</p>
                </div>
                <span className="arrow">›</span>
              </div>
            ))}
          </div>

          {subjects.length === 0 && (
            <div className="empty-state">No subjects available</div>
          )}
        </div>

        {/* Units Column */}
        <div className="curriculum-column">
          <h2>Units</h2>
          {selectedSubject ? (
            <div className="list">
              {units.map(unit => (
                <div
                  key={unit.id}
                  className={`list-item ${selectedUnit === unit.id ? 'active' : ''}`}
                  onClick={() => fetchLessons(unit.id)}
                >
                  <div className="list-item-content">
                    <h4>{unit.name}</h4>
                    <p className="list-item-meta">Unit {unit.unit_order}</p>
                  </div>
                  <span className="arrow">›</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Select a subject to view units</div>
          )}

          {selectedSubject && units.length === 0 && (
            <div className="empty-state">No units available</div>
          )}
        </div>

        {/* Lessons Column */}
        <div className="curriculum-column">
          <h2>Lessons</h2>
          {selectedUnit ? (
            <div className="list">
              {lessons.map(lesson => (
                <div key={lesson.id} className="lesson-card">
                  <div className="lesson-header">
                    <h4>{lesson.name}</h4>
                    <span className="badge">{lesson.duration_minutes}min</span>
                  </div>
                  <p className="lesson-description">{lesson.description}</p>
                  <div className="lesson-sections">
                    {lesson.sections?.map(section => (
                      <div key={section.id} className="section-item">
                        <span className="section-type">{section.section_type}</span>
                        <span className="section-title">{section.title}</span>
                      </div>
                    ))}
                  </div>
                  <button className="btn-secondary">View Lesson</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Select a unit to view lessons</div>
          )}

          {selectedUnit && lessons.length === 0 && (
            <div className="empty-state">No lessons available</div>
          )}
        </div>
      </div>
    </div>
  );
}
