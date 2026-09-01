import { useEffect, useState } from 'react';
import apiClient from '../utils/api';
import '../styles/dashboard.css';

const defaultForm = {
  title: '',
  description: '',
  gradeId: '',
  subjectId: '',
  unitId: '',
  durationMinutes: 45,
  totalMarks: 100,
  passingMark: 50,
  visibility: true,
  allowMultipleAttempts: false,
  maxAttempts: 1,
  showResultsImmediately: true,
};

export default function AdminExamPage() {
  const [exams, setExams] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [units, setUnits] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(defaultForm);
  const [questionForm, setQuestionForm] = useState({ questionText: '', marks: 5 });
  const [answerForms, setAnswerForms] = useState({});

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [examsRes, gradesRes, subjectsRes] = await Promise.all([
        apiClient.get('/exams?perPage=50'),
        apiClient.get('/subjects/grades/all'),
        apiClient.get('/subjects?perPage=100'),
      ]);

      const examList = examsRes.data.exams || [];
      setExams(examList);
      setGrades(gradesRes.data.grades || []);
      setSubjects(subjectsRes.data.data || subjectsRes.data.subjects || []);

      if (examList[0]) {
        loadExamDetails(examList[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load exam data');
    } finally {
      setLoading(false);
    }
  };

  const loadExamDetails = async (examId) => {
    try {
      const response = await apiClient.get(`/exams/${examId}`);
      setSelectedExam(response.data.exam || null);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load exam details');
    }
  };

  const handleGradeChange = async (gradeId) => {
    setForm((prev) => ({ ...prev, gradeId, subjectId: '', unitId: '' }));
    setUnits([]);

    if (!gradeId) {
      setSubjects([]);
      return;
    }

    try {
      const response = await apiClient.get('/subjects', { params: { grade: gradeId, perPage: 100 } });
      const list = response.data.data || response.data.subjects || [];
      setSubjects(list);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load subjects');
    }
  };

  const handleSubjectChange = async (subjectId) => {
    setForm((prev) => ({ ...prev, subjectId, unitId: '' }));

    if (!subjectId) {
      setUnits([]);
      return;
    }

    try {
      const response = await apiClient.get(`/subjects/${subjectId}/units`);
      setUnits(response.data.units || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load units');
    }
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();

    try {
      await apiClient.post('/exams', {
        ...form,
        gradeId: Number(form.gradeId),
        subjectId: Number(form.subjectId),
        unitId: form.unitId ? Number(form.unitId) : null,
        durationMinutes: Number(form.durationMinutes),
        totalMarks: Number(form.totalMarks),
        passingMark: Number(form.passingMark),
        maxAttempts: Number(form.maxAttempts),
      });

      const examsResponse = await apiClient.get('/exams?perPage=50');
      const examList = examsResponse.data.exams || [];
      setExams(examList);
      setForm(defaultForm);
      setUnits([]);
      if (examList[0]) {
        loadExamDetails(examList[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create exam');
    }
  };

  const handleAddQuestion = async (examId) => {
    if (!questionForm.questionText.trim()) {
      setError('Question text is required');
      return;
    }

    try {
      await apiClient.post(`/exams/${examId}/questions`, {
        questionText: questionForm.questionText.trim(),
        marks: Number(questionForm.marks),
        displayOrder: (selectedExam?.questions || []).length,
      });
      setQuestionForm({ questionText: '', marks: 5 });
      loadExamDetails(examId);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to add question');
    }
  };

  const handleAddAnswer = async (examId, questionId) => {
    const draft = answerForms[questionId] || { answerText: '', isCorrect: false };
    if (!draft.answerText?.trim()) {
      setError('Answer text is required');
      return;
    }

    try {
      await apiClient.post(`/exams/${examId}/questions/${questionId}/answers`, {
        answerText: draft.answerText.trim(),
        isCorrect: Boolean(draft.isCorrect),
        displayOrder: (selectedExam?.questions || []).find((question) => question.id === questionId)?.answers?.length || 0,
      });
      setAnswerForms((prev) => ({ ...prev, [questionId]: { answerText: '', isCorrect: false } }));
      loadExamDetails(examId);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to add answer');
    }
  };

  if (loading) return <div className="dashboard-loading">Loading exam management...</div>;

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Exam Management</h1>
          <p>Create and manage exams, questions, and answers</p>
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="card full-width">
          <h2>Create Exam</h2>
          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleCreateExam} style={{ display: 'grid', gap: 12 }}>
            <input
              placeholder="Exam title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <textarea
              placeholder="Exam description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <select value={form.gradeId} onChange={(e) => handleGradeChange(e.target.value)} required>
                <option value="">Select grade</option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>{grade.name}</option>
                ))}
              </select>

              <select value={form.subjectId} onChange={(e) => handleSubjectChange(e.target.value)} required disabled={!form.gradeId}>
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>

              <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} disabled={!form.subjectId}>
                <option value="">Select unit (optional)</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <input type="number" min="1" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} placeholder="Duration (min)" />
              <input type="number" min="1" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} placeholder="Total marks" />
              <input type="number" min="0" value={form.passingMark} onChange={(e) => setForm({ ...form, passingMark: e.target.value })} placeholder="Passing mark" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.allowMultipleAttempts} onChange={(e) => setForm({ ...form, allowMultipleAttempts: e.target.checked })} />
                Allow multiple attempts
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.showResultsImmediately} onChange={(e) => setForm({ ...form, showResultsImmediately: e.target.checked })} />
                Show results immediately
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.checked })} />
                Visible to students
              </label>
            </div>

            {form.allowMultipleAttempts && (
              <input
                type="number"
                min="1"
                value={form.maxAttempts}
                onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })}
                placeholder="Max attempts"
              />
            )}

            <button className="btn-primary" type="submit">Create exam</button>
          </form>
        </section>

        <section className="card full-width">
          <h2>Available Exams</h2>
          {exams.length > 0 ? (
            <div className="subject-list">
              {exams.map((exam) => (
                <button
                  key={exam.id}
                  className="subject-item"
                  style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  onClick={() => loadExamDetails(exam.id)}
                >
                  <h4>{exam.title}</h4>
                  <p>{exam.subject_name || 'General Subject'} · {exam.duration_minutes || 0} min</p>
                  <p>{exam.total_marks || 0} marks · {exam.questions_count || 0} questions</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-state">No exams available yet</p>
          )}
        </section>

        {selectedExam && (
          <section className="card full-width">
            <h2>{selectedExam.title}</h2>
            <p>{selectedExam.description || 'No description'}</p>

            <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 120px', gap: 8 }}>
                <input
                  placeholder="Question text"
                  value={questionForm.questionText}
                  onChange={(e) => setQuestionForm({ ...questionForm, questionText: e.target.value })}
                />
                <input
                  type="number"
                  min="1"
                  value={questionForm.marks}
                  onChange={(e) => setQuestionForm({ ...questionForm, marks: e.target.value })}
                />
              </div>
              <button className="btn-primary" onClick={() => handleAddQuestion(selectedExam.id)}>Add question</button>
            </div>

            <div style={{ marginTop: 24, display: 'grid', gap: 16 }}>
              {(selectedExam.questions || []).length > 0 ? (
                selectedExam.questions.map((question, idx) => (
                  <div key={question.id} className="card" style={{ background: '#f8fafc' }}>
                    <h3>Question {idx + 1}</h3>
                    <p>{question.question_text}</p>
                    <p><strong>Marks:</strong> {question.marks}</p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginTop: 12 }}>
                      <input
                        placeholder="Answer text"
                        value={answerForms[question.id]?.answerText || ''}
                        onChange={(e) => setAnswerForms((prev) => ({
                          ...prev,
                          [question.id]: { ...(prev[question.id] || { isCorrect: false }), answerText: e.target.value }
                        }))}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={answerForms[question.id]?.isCorrect || false}
                          onChange={(e) => setAnswerForms((prev) => ({
                            ...prev,
                            [question.id]: { ...(prev[question.id] || { answerText: '' }), isCorrect: e.target.checked }
                          }))}
                        />
                        Correct
                      </label>
                    </div>

                    <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => handleAddAnswer(selectedExam.id, question.id)}>
                      Add answer
                    </button>

                    {(question.answers || []).length > 0 && (
                      <ul style={{ marginTop: 12, paddingRight: 20 }}>
                        {question.answers.map((answer) => (
                          <li key={answer.id}>
                            {answer.answer_text} {answer.is_correct ? '✓' : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              ) : (
                <p className="empty-state">No questions added yet</p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
