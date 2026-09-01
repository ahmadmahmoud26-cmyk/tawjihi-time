import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/api';
import { useAuthStore } from '../utils/authStore';
import '../styles/dashboard.css';

export default function StudentManagementPage() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [programCatalog, setProgramCatalog] = useState({ stages: [], fields: [], fieldSubjects: [], stageSubjects: [] });
  const [editingStudent, setEditingStudent] = useState(null);
  const [scheduleFile, setScheduleFile] = useState(null);
  const [schedulePreview, setSchedulePreview] = useState('');
  const [uploadingSchedule, setUploadingSchedule] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    stageId: '',
    fieldId: '',
    subjectIds: []
  });
  const [createLoading, setCreateLoading] = useState(false);
  const isPrimarySuperAdmin = user?.role === 'super_admin' && user?.email?.toLowerCase() === 'ahmad169qyp12q@gmail.com';

  useEffect(() => {
    fetchStudents();
    fetchProgramCatalog();
  }, [page, searchTerm]);

  const fetchProgramCatalog = async () => {
    try {
      const response = await apiClient.get('/admin/student-program-catalog');
      setProgramCatalog({
        stages: response.data.stages || [],
        fields: response.data.fields || [],
        fieldSubjects: response.data.fieldSubjects || [],
        stageSubjects: response.data.stageSubjects || []
      });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في تحميل المراحل والمواد');
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      let url = `/admin/students/list?page=${page}&perPage=20`;
      if (searchTerm) url += `&search=${searchTerm}`;

      const response = await apiClient.get(url);
      setStudents(response.data.students || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load student data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setError('');
    setCreateLoading(true);

    try {
      const response = editingStudent
        ? await apiClient.put(`/admin/students/${editingStudent.id}/program`, {
          stageId: Number(formData.stageId),
          fieldId: formData.fieldId ? Number(formData.fieldId) : null,
          subjectIds: formData.subjectIds
        })
        : await apiClient.post('/admin/create-student', {
          ...formData,
          stageId: Number(formData.stageId),
          fieldId: formData.fieldId ? Number(formData.fieldId) : null
        });
      
      if (response.data.success) {
        setShowCreateForm(false);
        setEditingStudent(null);
        setFormData({ name: '', email: '', password: '', stageId: '', fieldId: '', subjectIds: [] });
        fetchStudents();
        alert(editingStudent ? '✅ تم تحديث مرحلة ومواد الطالب بنجاح!' : '✅ تم إنشاء حساب الطالب بنجاح!');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في إنشاء حساب الطالب');
    } finally {
      setCreateLoading(false);
    }
  };

  const selectedStage = programCatalog.stages.find(stage => stage.id === Number(formData.stageId));
  const fieldsForStage = programCatalog.fields.filter(field => field.stage_id === Number(formData.stageId));
  const needsField = fieldsForStage.length > 0;
  const availableSubjects = needsField
    ? programCatalog.fieldSubjects.filter(subject => subject.stage_id === Number(formData.stageId) && subject.field_id === Number(formData.fieldId))
    : programCatalog.stageSubjects.filter(subject => subject.stage_id === Number(formData.stageId));

  const handleStageChange = (stageId) => {
    setFormData(current => ({ ...current, stageId, fieldId: '', subjectIds: [] }));
  };

  const handleFieldChange = (fieldId) => {
    setFormData(current => ({ ...current, fieldId, subjectIds: [] }));
  };

  const toggleSubject = (subjectId) => {
    setFormData(current => ({
      ...current,
      subjectIds: current.subjectIds.includes(subjectId)
        ? current.subjectIds.filter(id => id !== subjectId)
        : [...current.subjectIds, subjectId]
    }));
  };

  const handleEditProgram = async (student) => {
    try {
      setError('');
      const response = await apiClient.get(`/admin/students/${student.id}/program`);
      const program = response.data.student;
      setEditingStudent(student);
      setFormData({
        name: student.name,
        email: student.email,
        password: '',
        stageId: program.stage_id || '',
        fieldId: program.academic_field_id || '',
        subjectIds: (program.subjectIds || []).map(Number)
      });
      setShowCreateForm(true);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في تحميل بيانات الطالب');
    }
  };

  const handleOpenStudentChat = (student) => {
    navigate('/admin/messages', {
      state: {
        autoChatStudentId: student.id,
        autoChatStudentName: student.name
      }
    });
  };

  const handleScheduleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSchedulePreview(reader.result);
      setScheduleFile(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSchedule = async () => {
    if (!selectedStudent || !schedulePreview) return;

    try {
      setUploadingSchedule(true);
      await apiClient.post(`/students/${selectedStudent.id}/schedules`, {
        imageUrl: schedulePreview,
        fileName: scheduleFile || `${selectedStudent.name}-schedule.png`
      });
      setSchedulePreview('');
      setScheduleFile(null);
      setSelectedStudent(null);
      alert('✅ تم إرسال الجدول الخاص للطالب بنجاح');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في إرسال الجدول الخاص');
    } finally {
      setUploadingSchedule(false);
    }
  };

  if (loading && students.length === 0) return <div className="dashboard-loading">جاري تحميل بيانات الطلاب...</div>;

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>جداول الطلاب</h1>
          <p>عرض جميع الطلاب وإدارة محادثاتهم</p>
        </div>
      </header>

      {isPrimarySuperAdmin && <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => {
            if (showCreateForm) {
              setEditingStudent(null);
              setFormData({ name: '', email: '', password: '', stageId: '', fieldId: '', subjectIds: [] });
            }
            setShowCreateForm(!showCreateForm);
          }}
          style={{
            padding: '12px 20px',
            backgroundColor: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {showCreateForm ? '❌ إلغاء' : '➕ إنشاء حساب طالب جديد'}
        </button>
      </div>}

      {isPrimarySuperAdmin && showCreateForm && (
        <div className="card full-width" style={{ backgroundColor: '#f8f9fa', marginBottom: '20px' }}>
          <h3>{editingStudent ? `📝 تعديل برنامج الطالب: ${editingStudent.name}` : '📝 إنشاء حساب طالب جديد'}</h3>
          
          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleCreateStudent} style={{ display: 'grid', gap: '15px' }}>
            {!editingStudent && <div>
              <label>🎓 اسم الطالب</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="أدخل اسم الطالب"
                required
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
              />
            </div>}

            {!editingStudent && <div>
              <label>📧 البريد الإلكتروني</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="البريد الإلكتروني للطالب"
                required
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
              />
            </div>}

            {!editingStudent && <div>
              <label>🔐 كلمة المرور (على الأقل 6 أحرف)</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="أدخل كلمة المرور"
                required
                minLength="6"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
              />
            </div>}

            <div>
              <label>📚 مرحلة الطالب الصفية</label>
              <select
                value={formData.stageId}
                onChange={(e) => handleStageChange(e.target.value)}
                required
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="">-- اختر المرحلة --</option>
                {programCatalog.stages.map(stage => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedStage && needsField && (
              <div>
                <label>الحقل الخاص بالطالب</label>
                <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
                  {fieldsForStage.map(field => (
                    <label key={field.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, cursor: 'pointer' }}>
                      <input type="radio" name="student-field" checked={Number(formData.fieldId) === field.id} onChange={() => handleFieldChange(field.id)} required style={{ width: 'auto' }} />
                      {field.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {selectedStage && (!needsField || formData.fieldId) && (
              <div>
                <label>المواد المتاحة</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginTop: '8px' }}>
                  {availableSubjects.map(subject => (
                    <label key={subject.subject_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, padding: '10px', border: '1px solid #dbe3e0', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}>
                      <input type="checkbox" checked={formData.subjectIds.includes(subject.subject_id)} onChange={() => toggleSubject(subject.subject_id)} style={{ width: 'auto' }} />
                      {subject.subject_name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={createLoading}
              style={{
                padding: '12px 20px',
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: createLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              {createLoading ? '⏳ جاري الحفظ...' : editingStudent ? '✅ حفظ تعديلات الطالب' : '✅ إنشاء حساب الطالب'}
            </button>
          </form>
        </div>
      )}

      <div className="card full-width">
        {selectedStudent && (
          <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid #dbeafe', borderRadius: '12px', background: '#eff6ff' }}>
            <h3 style={{ marginTop: 0 }}>إرسال جدول خاص إلى {selectedStudent.name}</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <input type="file" accept="image/*" onChange={handleScheduleFileChange} />
              {schedulePreview && (
                <img src={schedulePreview} alt="جدول مرفق" style={{ maxHeight: '220px', objectFit: 'contain', borderRadius: '10px' }} />
              )}
              <button
                type="button"
                onClick={handleUploadSchedule}
                disabled={!schedulePreview || uploadingSchedule}
                style={{
                  padding: '10px 16px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: !schedulePreview || uploadingSchedule ? 'not-allowed' : 'pointer',
                  opacity: !schedulePreview || uploadingSchedule ? 0.7 : 1
                }}
              >
                {uploadingSchedule ? 'جارٍ الإرسال...' : 'إرسال الجدول الخاص'}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="🔍 البحث باسم أو بريد إلكتروني"
            style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e0', width: '100%' }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '12px', textAlign: 'right' }}>🎓 اسم الطالب</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>📧 البريد الإلكتروني</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>📚 السنة</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>المرحلة والحقل</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>📊 محاولات الاختبار</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>✅ الحالة</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>💬 المحادثة</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr
                  key={student.id}
                  style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                  onClick={() => handleOpenStudentChat(student)}
                >
                  <td style={{ padding: '12px' }}>{student.name}</td>
                  <td style={{ padding: '12px' }}>{student.email}</td>
                  <td style={{ padding: '12px' }}>{student.grade_name || '-'}</td>
                  <td style={{ padding: '12px' }}>{student.stage_name || '-'}{student.field_name ? ` / ${student.field_name}` : ''}</td>
                  <td style={{ padding: '12px' }}>{student.exam_attempts || 0}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '20px',
                      backgroundColor: student.account_status === 'active' ? '#d4edda' : '#f8d7da',
                      color: student.account_status === 'active' ? '#155724' : '#721c24'
                    }}>
                      {student.account_status === 'active' ? '✅ نشط' : '❌ معطل'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStudent(student);
                        setSchedulePreview('');
                        setScheduleFile(null);
                      }}
                      style={{
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '8px',
                        background: '#0ea5e9',
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: '600',
                        marginLeft: '8px'
                      }}
                    >
                      جدول خاص
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditProgram(student);
                      }}
                      style={{ padding: '8px 12px', border: 'none', borderRadius: '8px', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontWeight: '600', marginLeft: '8px' }}
                    >
                      تعديل المواد
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenStudentChat(student);
                      }}
                      style={{
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '8px',
                        background: '#2563eb',
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      فتح المحادثة
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {students.length === 0 && !loading && (
          <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            لا توجد حسابات طلاب. 👈 انقر على زر "إنشاء حساب طالب جديد" لبدء الإضافة.
          </p>
        )}
      </div>
    </div>
  );
}
