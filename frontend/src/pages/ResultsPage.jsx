import { useState, useEffect } from 'react';
import apiClient from '../utils/api';
import '../styles/results.css';

export default function ResultsPage() {
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchResults();
  }, [filter]);

  const fetchResults = async () => {
    try {
      const params = filter === 'all' ? {} : { status: filter };
      const response = await apiClient.get('/results', { params });
      setResults(response.data.results || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="results-loading">Loading results...</div>;

  return (
    <div className="results-container">
      <header className="page-header">
        <h1>My Results</h1>
        <p>Review your exam results and performance</p>
      </header>

      <div className="filter-bar">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          All Results
        </button>
        <button className={`filter-btn ${filter === 'passed' ? 'active' : ''}`} onClick={() => setFilter('passed')}>
          Passed
        </button>
        <button className={`filter-btn ${filter === 'failed' ? 'active' : ''}`} onClick={() => setFilter('failed')}>
          Failed
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="results-grid">
        {results.map((result) => (
          <div key={result.id} className="result-card" onClick={() => setSelectedResult(result)}>
            <div className="result-header">
              <h3>{result.exam_title}</h3>
              <span className={`score-badge ${result.percentage >= 70 ? 'pass' : 'fail'}`}>
                {result.percentage}%
              </span>
            </div>

            <div className="result-details">
              <p><strong>Subject:</strong> {result.subject_name}</p>
              <p><strong>Score:</strong> {result.score}/{result.total_marks}</p>
              <p><strong>Date:</strong> {new Date(result.created_at).toLocaleDateString()}</p>
            </div>

            <div className="result-progress">
              <div className="progress-bar">
                <div
                  className={`progress-fill ${result.percentage >= 70 ? 'pass' : 'fail'}`}
                  style={{ width: `${result.percentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {results.length === 0 && (
        <div className="empty-state">
          <p>No results available yet</p>
        </div>
      )}

      {selectedResult && (
        <div className="modal-overlay" onClick={() => setSelectedResult(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedResult(null)}>×</button>

            <h2>{selectedResult.exam_title}</h2>

            <div className="result-modal-body">
              <div className="result-stat">
                <span className="stat-label">Your Score</span>
                <span className="stat-value">{selectedResult.score}/{selectedResult.total_marks}</span>
              </div>

              <div className="result-stat">
                <span className="stat-label">Percentage</span>
                <span className={`stat-value ${selectedResult.percentage >= 70 ? 'pass' : 'fail'}`}>
                  {selectedResult.percentage}%
                </span>
              </div>

              <div className="result-stat">
                <span className="stat-label">Status</span>
                <span className={`badge ${selectedResult.passed ? 'badge-success' : 'badge-danger'}`}>
                  {selectedResult.passed ? 'Passed' : 'Failed'}
                </span>
              </div>

              <div className="result-stat">
                <span className="stat-label">Date Attempted</span>
                <span className="stat-value">{new Date(selectedResult.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
