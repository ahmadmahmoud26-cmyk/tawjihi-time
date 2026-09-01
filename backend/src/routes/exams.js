const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, requireAdmin, requirePermission } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');

// Student starts exam (frontend compatibility)
router.post(
  '/start/:examId',
  verifyToken,
  [body('examId').optional().isInt().toInt()],
  async (req, res) => {
    try {
      const studentId = req.user.id;
      const examId = req.params.examId;

      const examResult = await pool.query(
        `SELECT id, total_marks, max_attempts, allow_multiple_attempts FROM exams
        WHERE id = ? AND visibility = true AND deleted_at IS NULL`,
        [examId]
      );

      if (examResult.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Exam not found' } });
      }

      const exam = examResult.rows[0];

      if (exam.allow_multiple_attempts && exam.max_attempts) {
        const attemptsResult = await pool.query(
          `SELECT COUNT(*) as attempts FROM exam_attempts
          WHERE student_id = ? AND exam_id = ? AND status = 'submitted'`,
          [studentId, examId]
        );

        if (attemptsResult.rows[0].attempts >= exam.max_attempts) {
          return res.status(403).json({ error: { status: 403, message: 'Maximum attempts reached' } });
        }
      }

      const result = await pool.query(
        `INSERT INTO exam_attempts (student_id, exam_id, started_at, status)
        VALUES (?, ?, datetime('now'), 'in_progress')
        RETURNING id, started_at`,
        [studentId, examId]
      );

      const questionsResult = await pool.query(
        `SELECT id, question_text, marks, display_order
        FROM questions
        WHERE exam_id = ?
        ORDER BY display_order ASC, id ASC`,
        [examId]
      );

      const questions = await Promise.all(
        questionsResult.rows.map(async (question) => {
          const answersResult = await pool.query(
            `SELECT id, answer_text, display_order
            FROM answers
            WHERE question_id = ?
            ORDER BY display_order ASC, id ASC`,
            [question.id]
          );

          return {
            ...question,
            question_type: 'multiple_choice',
            options: answersResult.rows.map((answer) => answer.answer_text),
            answers: answersResult.rows
          };
        })
      );

      res.json({
        success: true,
        attempt_id: result.rows[0].id,
        attempt: result.rows[0],
        questions,
        message: 'Exam started'
      });
    } catch (error) {
      console.error('Error starting exam:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Get all exams (with filtering and pagination)
router.get(
  '/',
  verifyToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('grade').optional().isInt().toInt(),
    query('subject').optional().isInt().toInt(),
    query('unit').optional().isInt().toInt(),
    query('search').optional().trim().isLength({ min: 1 }),
    query('visibility').optional().isIn(['true', 'false']),
    query('sortBy').optional().isIn(['title', 'created_at', 'total_marks']),
    query('sortOrder').optional().isIn(['ASC', 'DESC']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const page = req.query.page || 1;
      const perPage = req.query.perPage || 20;
      const offset = (page - 1) * perPage;
      const gradeId = req.query.grade;
      const subjectId = req.query.subject;
      const unitId = req.query.unit;
      const search = req.query.search;
      const visibility = req.query.visibility === 'true' ? true : (req.query.visibility === 'false' ? false : null);
      const sortBy = req.query.sortBy || 'created_at';
      const sortOrder = req.query.sortOrder || 'DESC';

      // Build query
      let whereClause = 'WHERE e.deleted_at IS NULL';
      let params = [];
      let paramCount = 1;

      if (gradeId) {
        whereClause += ` AND e.grade_id = $${paramCount}`;
        params.push(gradeId);
        paramCount++;
      }

      if (subjectId) {
        whereClause += ` AND e.subject_id = $${paramCount}`;
        params.push(subjectId);
        paramCount++;
      }

      if (unitId) {
        whereClause += ` AND e.unit_id = $${paramCount}`;
        params.push(unitId);
        paramCount++;
      }

      if (search) {
        whereClause += ` AND (e.title LIKE $${paramCount} OR e.description LIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
      }

      if (visibility !== null) {
        whereClause += ` AND e.visibility = $${paramCount}`;
        params.push(visibility);
        paramCount++;
      }

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM exams e ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      // Get exams with related info
      const query = `
        SELECT
          e.id,
          e.title,
          e.description,
          e.grade_id,
          g.name as grade_name,
          e.subject_id,
          s.name as subject_name,
          e.unit_id,
          u.name as unit_name,
          e.duration_minutes,
          e.total_marks,
          e.passing_mark,
          e.visibility,
          e.allow_multiple_attempts,
          e.max_attempts,
          e.show_results_immediately,
          e.created_by,
          cr.name as created_by_name,
          e.created_at,
          e.updated_at,
          (SELECT COUNT(*) FROM questions WHERE exam_id = e.id) as questions_count,
          (SELECT COUNT(*) FROM exam_attempts WHERE exam_id = e.id) as attempts_count
        FROM exams e
        LEFT JOIN grades g ON e.grade_id = g.id
        LEFT JOIN subjects s ON e.subject_id = s.id
        LEFT JOIN units u ON e.unit_id = u.id
        LEFT JOIN users cr ON e.created_by = cr.id
        ${whereClause}
        ORDER BY e.${sortBy} ${sortOrder}
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;

      params.push(perPage, offset);
      const result = await pool.query(query, params);

      res.json({
        success: true,
        exams: result.rows,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage)
        }
      });
    } catch (error) {
      console.error('Error fetching exams:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Get single exam with questions
router.get('/:id', async (req, res) => {
  try {
    const examId = req.params.id;

    // Get exam details
    const examResult = await pool.query(
      `SELECT
        e.id,
        e.title,
        e.description,
        e.grade_id,
        g.name as grade_name,
        e.subject_id,
        s.name as subject_name,
        e.unit_id,
        u.name as unit_name,
        e.duration_minutes,
        e.total_marks,
        e.passing_mark,
        e.visibility,
        e.allow_multiple_attempts,
        e.max_attempts,
        e.show_results_immediately,
        e.created_by,
        e.created_at
      FROM exams e
      LEFT JOIN grades g ON e.grade_id = g.id
      LEFT JOIN subjects s ON e.subject_id = s.id
      LEFT JOIN units u ON e.unit_id = u.id
      WHERE e.id = ? AND e.deleted_at IS NULL`,
      [examId]
    );

    if (examResult.rows.length === 0) {
      return res.status(404).json({ error: { status: 404, message: 'Exam not found' } });
    }

    const exam = examResult.rows[0];

    // Get questions with answers
    const questionsResult = await pool.query(
      `SELECT
        q.id,
        q.question_text,
        q.marks,
        q.display_order,
        q.created_at
      FROM questions q
      WHERE q.exam_id = ?
      ORDER BY q.display_order ASC`,
      [examId]
    );

    // Get answers for each question
    const questionsWithAnswers = await Promise.all(
      questionsResult.rows.map(async (question) => {
        const answersResult = await pool.query(
          `SELECT id, answer_text, is_correct, display_order
          FROM answers
          WHERE question_id = ?
          ORDER BY display_order ASC`,
          [question.id]
        );
        return {
          ...question,
          answers: answersResult.rows
        };
      })
    );

    res.json({
      success: true,
      exam: {
        ...exam,
        questions: questionsWithAnswers
      }
    });
  } catch (error) {
    console.error('Error fetching exam:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

// Create exam
router.post(
  '/',
  verifyToken,
  requireAdmin,
  requirePermission('manage_exams'),
  [
    body('title').trim().notEmpty().isLength({ min: 2, max: 255 }),
    body('description').optional().trim(),
    body('gradeId').isInt(),
    body('subjectId').isInt(),
    body('unitId').optional().isInt(),
    body('durationMinutes').optional().isInt().toInt(),
    body('totalMarks').isInt().toInt(),
    body('passingMark').optional().isInt().toInt(),
    body('visibility').optional().isBoolean(),
    body('allowMultipleAttempts').optional().isBoolean(),
    body('maxAttempts').optional().isInt().toInt(),
    body('showResultsImmediately').optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const {
        title,
        description,
        gradeId,
        subjectId,
        unitId,
        durationMinutes,
        totalMarks,
        passingMark,
        visibility = true,
        allowMultipleAttempts = false,
        maxAttempts,
        showResultsImmediately = true
      } = req.body;

      // Verify grade and subject exist
      const gradeCheck = await pool.query('SELECT id FROM grades WHERE id = ?', [gradeId]);
      const subjectCheck = await pool.query('SELECT id FROM subjects WHERE id = ? AND deleted_at IS NULL', [subjectId]);

      if (gradeCheck.rows.length === 0 || subjectCheck.rows.length === 0) {
        return res.status(400).json({ error: { status: 400, message: 'Grade or subject not found' } });
      }

      const result = await pool.query(
        `INSERT INTO exams (
          title, description, grade_id, subject_id, unit_id, duration_minutes,
          total_marks, passing_mark, visibility, allow_multiple_attempts,
          max_attempts, show_results_immediately, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        RETURNING id, title, grade_id, subject_id, total_marks, created_at`,
        [
          title, description, gradeId, subjectId, unitId, durationMinutes,
          totalMarks, passingMark, visibility, allowMultipleAttempts,
          maxAttempts, showResultsImmediately, req.user.id
        ]
      );

      const exam = result.rows[0];

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'exam_created', 'exam', exam.id]
      );

      // Create notification for students
      await pool.query(
        `INSERT INTO notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
        SELECT u.id, 'exam', 'New Exam', ?, 'exam', ?
        FROM users u
        WHERE u.role = 'student' AND u.grade_id = ?`,
        [`New exam "${title}" is available`, exam.id, gradeId]
      );

      res.status(201).json({
        success: true,
        exam,
        message: 'Exam created successfully'
      });
    } catch (error) {
      console.error('Error creating exam:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Update exam
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  requirePermission('manage_exams'),
  async (req, res) => {
    try {
      const examId = req.params.id;
      const updates = req.body;

      // Build dynamic update
      const allowedFields = [
        'title', 'description', 'durationMinutes', 'totalMarks', 'passingMark',
        'visibility', 'allowMultipleAttempts', 'maxAttempts', 'showResultsImmediately'
      ];

      let updateFields = ["updated_at = datetime('now')"];
      let params = [];
      let paramCount = 1;

      for (const field of allowedFields) {
        if (field in updates) {
          const dbField = field.replace(/([A-Z])/g, '_?').toLowerCase();
          updateFields.push(`${dbField} = $${paramCount}`);
          params.push(updates[field]);
          paramCount++;
        }
      }

      if (updateFields.length === 1) {
        return res.status(400).json({ error: { status: 400, message: 'No valid fields to update' } });
      }

      params.push(examId);

      const result = await pool.query(
        `UPDATE exams SET ${updateFields.join(', ')}
        WHERE id = $${paramCount} AND deleted_at IS NULL
        RETURNING id, title, total_marks, updated_at`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Exam not found' } });
      }

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'exam_updated', 'exam', examId]
      );

      res.json({
        success: true,
        exam: result.rows[0],
        message: 'Exam updated successfully'
      });
    } catch (error) {
      console.error('Error updating exam:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Delete exam (soft delete)
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  requirePermission('manage_exams'),
  async (req, res) => {
    try {
      const examId = req.params.id;

      const result = await pool.query(
        `UPDATE exams SET deleted_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ? AND deleted_at IS NULL
        RETURNING id`,
        [examId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Exam not found' } });
      }

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'exam_deleted', 'exam', examId]
      );

      res.json({
        success: true,
        message: 'Exam deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting exam:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Add question to exam
router.post(
  '/:examId/questions',
  verifyToken,
  requireAdmin,
  requirePermission('manage_questions'),
  [
    body('questionText').trim().notEmpty(),
    body('marks').isInt({ min: 1 }).toInt(),
    body('displayOrder').optional().isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const examId = req.params.examId;
      const { questionText, marks, displayOrder = 0 } = req.body;

      // Verify exam exists
      const examCheck = await pool.query(
        'SELECT id FROM exams WHERE id = ? AND deleted_at IS NULL',
        [examId]
      );

      if (examCheck.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Exam not found' } });
      }

      const result = await pool.query(
        `INSERT INTO questions (exam_id, question_text, marks, display_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        RETURNING id, question_text, marks, display_order`,
        [examId, questionText, marks, displayOrder]
      );

      const question = result.rows[0];

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'question_created', 'question', question.id]
      );

      res.status(201).json({
        success: true,
        question,
        message: 'Question added successfully'
      });
    } catch (error) {
      console.error('Error adding question:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Update question
router.put(
  '/:examId/questions/:questionId',
  verifyToken,
  requireAdmin,
  requirePermission('manage_questions'),
  [
    body('questionText').optional().trim().notEmpty(),
    body('marks').optional().isInt({ min: 1 }).toInt(),
    body('displayOrder').optional().isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const questionId = req.params.questionId;
      const { questionText, marks, displayOrder } = req.body;

      let updateFields = ["updated_at = datetime('now')"];
      let params = [];
      let paramCount = 1;

      if (questionText) {
        updateFields.push(`question_text = $${paramCount}`);
        params.push(questionText);
        paramCount++;
      }

      if (marks) {
        updateFields.push(`marks = $${paramCount}`);
        params.push(marks);
        paramCount++;
      }

      if (displayOrder !== undefined) {
        updateFields.push(`display_order = $${paramCount}`);
        params.push(displayOrder);
        paramCount++;
      }

      params.push(questionId);

      const result = await pool.query(
        `UPDATE questions SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, question_text, marks, display_order`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Question not found' } });
      }

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'question_updated', 'question', questionId]
      );

      res.json({
        success: true,
        question: result.rows[0],
        message: 'Question updated successfully'
      });
    } catch (error) {
      console.error('Error updating question:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Delete question
router.delete(
  '/:examId/questions/:questionId',
  verifyToken,
  requireAdmin,
  requirePermission('manage_questions'),
  async (req, res) => {
    try {
      const questionId = req.params.questionId;

      // Delete question and cascade answers
      const result = await pool.query(
        `DELETE FROM questions WHERE id = ? RETURNING id`,
        [questionId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Question not found' } });
      }

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'question_deleted', 'question', questionId]
      );

      res.json({
        success: true,
        message: 'Question deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting question:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Add answer to question
router.post(
  '/:examId/questions/:questionId/answers',
  verifyToken,
  requireAdmin,
  requirePermission('manage_questions'),
  [
    body('answerText').trim().notEmpty(),
    body('isCorrect').isBoolean(),
    body('displayOrder').optional().isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const questionId = req.params.questionId;
      const { answerText, isCorrect, displayOrder = 0 } = req.body;

      // Verify question exists
      const questionCheck = await pool.query(
        'SELECT id FROM questions WHERE id = ?',
        [questionId]
      );

      if (questionCheck.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Question not found' } });
      }

      const result = await pool.query(
        `INSERT INTO answers (question_id, answer_text, is_correct, display_order, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        RETURNING id, answer_text, is_correct, display_order`,
        [questionId, answerText, isCorrect, displayOrder]
      );

      res.status(201).json({
        success: true,
        answer: result.rows[0],
        message: 'Answer added successfully'
      });
    } catch (error) {
      console.error('Error adding answer:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Update answer
router.put(
  '/:examId/questions/:questionId/answers/:answerId',
  verifyToken,
  requireAdmin,
  requirePermission('manage_questions'),
  [
    body('answerText').optional().trim().notEmpty(),
    body('isCorrect').optional().isBoolean(),
    body('displayOrder').optional().isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const answerId = req.params.answerId;
      const { answerText, isCorrect, displayOrder } = req.body;

      let updateFields = [];
      let params = [];
      let paramCount = 1;

      if (answerText) {
        updateFields.push(`answer_text = $${paramCount}`);
        params.push(answerText);
        paramCount++;
      }

      if (isCorrect !== undefined) {
        updateFields.push(`is_correct = $${paramCount}`);
        params.push(isCorrect);
        paramCount++;
      }

      if (displayOrder !== undefined) {
        updateFields.push(`display_order = $${paramCount}`);
        params.push(displayOrder);
        paramCount++;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: { status: 400, message: 'No fields to update' } });
      }

      params.push(answerId);

      const result = await pool.query(
        `UPDATE answers SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, answer_text, is_correct, display_order`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Answer not found' } });
      }

      res.json({
        success: true,
        answer: result.rows[0],
        message: 'Answer updated successfully'
      });
    } catch (error) {
      console.error('Error updating answer:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Delete answer
router.delete(
  '/:examId/questions/:questionId/answers/:answerId',
  verifyToken,
  requireAdmin,
  requirePermission('manage_questions'),
  async (req, res) => {
    try {
      const answerId = req.params.answerId;

      const result = await pool.query(
        `DELETE FROM answers WHERE id = ? RETURNING id`,
        [answerId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Answer not found' } });
      }

      res.json({
        success: true,
        message: 'Answer deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting answer:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

module.exports = router;
