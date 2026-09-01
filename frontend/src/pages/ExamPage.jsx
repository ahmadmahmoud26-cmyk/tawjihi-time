import { useState, useEffect } from 'react';
import apiClient from '../utils/api';
import '../styles/exams.css';

export default function ExamPage() {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [examInProgress, setExamInProgress] = useState(false);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const response = await apiClient.get('/exams?perPage=20');
      setExams(response.data.exams || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  const startExam = async (examId) => {
    try {
      const exam = exams.find((item) => item.id === examId);
      const response = await apiClient.post(`/results/start/${examId}`);
      setSelectedExam({
        ...exam,
        attemptId: response.data.attempt_id,
        questions: response.data.questions || []
      });
      setAnswers({});
      setExamInProgress(true);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to start exam');
    }
  };

  const submitAnswer = async (questionId, answer) => {
    if (!selectedExam?.attemptId) return;

    setAnswers((prev) => ({ ...prev, [questionId]: answer }));

    try {
      await apiClient.post(`/results/${selectedExam.attemptId}/answer`, {
        questionId,
        answer
      });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to submit answer');
    }
  };

  const finishExam = async () => {
    if (!selectedExam?.attemptId) return;

    try {
      const response = await apiClient.post(`/results/${selectedExam.attemptId}/finish`);
      const result = response.data.result;
      const scoreText = result ? `${result.score}/${result.total_marks}` : 'تم حفظ الاختبار';

      setExamInProgress(false);
      setSelectedExam(null);
      setError(`Exam completed! Your score: ${scoreText}`);
      await fetchExams();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to finish exam');
    }
  };

  if (loading) return <div className="exam-loading">Loading exams...</div>;

  if (examInProgress && selectedExam) {
    return (
      <div className="exam-container">
        <div className="exam-header">
          <h1>{selectedExam.title}</h1>
          <div className="exam-timer">
            <span>Time Remaining: {selectedExam.duration_minutes || 0} minutes</span>
          </div>
        </div>

        <div className="exam-questions">
          {selectedExam.questions?.map((question, idx) => (
            <div key={question.id} className="question-card">
              <h3>Question {idx + 1}</h3>
              <p className="question-text">{question.question_text}</p>

              {question.options?.length > 0 && (
                <div className="options">
                  {question.options.map((option, optIdx) => (
                    <label key={optIdx} className="option">
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={option}
                        checked={answers[question.id] === option}
                        onChange={() => submitAnswer(question.id, option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {!question.options?.length && (
                <textarea
                  placeholder="Enter your answer here..."
                  value={answers[question.id] || ''}
                  onChange={(e) => submitAnswer(question.id, e.target.value)}
                  rows="4"
                />
              )}

              <p className="question-marks">Marks: {question.marks}</p>
            </div>
          ))}
        </div>

        <div className="exam-actions">
          <button className="btn-primary" onClick={finishExam}>
            Finish Exam
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-list-container">
      <header className="page-header">
        <h1>Available Exams</h1>
        <p>Select an exam to begin</p>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="exams-grid">
        {exams.map((exam) => (
          <div key={exam.id} className="exam-card">
            <div className="exam-card-header">
              <h2>{exam.title}</h2>
              <span className="exam-marks">{exam.total_marks} Marks</span>
            </div>

            <div className="exam-card-body">
              <p><strong>Subject:</strong> {exam.subject_name}</p>
              <p><strong>Duration:</strong> {exam.duration_minutes} minutes</p>
              <p><strong>Questions:</strong> {exam.questions_count || exam.total_questions || 0}</p>
              <p><strong>Type:</strong> {exam.exam_type || 'quiz'}</p>
            </div>

            <div className="exam-card-footer">
              {exam.student_attempt ? (
                <span className="badge badge-success">Attempted</span>
              ) : (
                <button className="btn-primary" onClick={() => startExam(exam.id)}>
                  Start Exam
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {exams.length === 0 && (
        <div className="empty-state">
          <p>No exams available at the moment</p>
        </div>
      )}
    </div>
  );
}
