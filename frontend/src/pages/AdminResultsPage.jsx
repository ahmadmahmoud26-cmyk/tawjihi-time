import { useEffect, useState } from 'react';
import apiClient from '../utils/api';
import '../styles/dashboard.css';

export default function AdminResultsPage() {
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const response = await apiClient.get('/exams?perPage=20');
        const examList = response.data.exams || [];
        setExams(examList);

        if (examList[0]) {
          setSelectedExamId(examList[0].id);
          fetchExamResults(examList[0].id);
        }
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Failed to load exam results');
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

  const fetchExamResults = async (examId) => {
    try {
      const response = await apiClient.get(`/results/admin/exam/${examId}`);
      setResults(response.data.results || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load exam results');
      setResults([]);
    }
  };

  if (loading) return <div className="dashboard-loading">Loading results...</div>;

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Results Overview</h1>
          <p>Performance snapshot by exam</p>
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="card full-width">
          <h2>Available Exams</h2>
          {error && <div className="error-message">{error}</div>}

          {exams.length > 0 ? (
            <div className="subject-list">
              {exams.map((exam) => (
                <button
                  key={exam.id}
                  className={`subject-item ${selectedExamId === exam.id ? 'active' : ''}`}
                  style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedExamId(exam.id);
                    fetchExamResults(exam.id);
                  }}
                >
                  <h4>{exam.title}</h4>
                  <p>{exam.subject_name || 'General Subject'}</p>
                  <p>Attempts: {exam.attempts_count || 0} · Total marks: {exam.total_marks || 0}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-state">No results available yet</p>
          )}
        </section>

        <section className="card full-width">
          <h2>{selectedExamId ? 'Exam Results' : 'No exam selected'}</h2>
          {results.length > 0 ? (
            <div className="subject-list">
              {results.map((result) => (
                <div key={result.id} className="subject-item">
                  <h4>{result.student_name}</h4>
                  <p>Score: {result.score}/{result.total_marks}</p>
                  <p>Percentage: {result.percentage}%</p>
                  <p>Status: {result.passed ? 'Passed' : 'Failed'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No attempts recorded for this exam yet</p>
          )}
        </section>
      </div>
    </div>
  );
}
