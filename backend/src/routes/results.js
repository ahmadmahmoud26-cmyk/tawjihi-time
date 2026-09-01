const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, requireAdmin, requirePermission } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');

// Get current user results (frontend compatibility)
router.get(
  '/',
  verifyToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['all', 'passed', 'failed'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const studentId = req.user.role === 'student' ? req.user.id : parseInt(req.query.studentId || req.user.id);
      const page = req.query.page || 1;
      const perPage = req.query.perPage || 20;
      const offset = (page - 1) * perPage;
      const statusFilter = req.query.status || 'all';

      if (req.user.role === 'student' && studentId !== req.user.id) {
        return res.status(403).json({
          error: { status: 403, message: 'Cannot view other student results' }
        });
      }

      let whereClause = 'WHERE er.student_id = ?';
      const params = [studentId];

      if (statusFilter === 'passed') {
        whereClause += ' AND er.passed = true';
      } else if (statusFilter === 'failed') {
        whereClause += ' AND er.passed = false';
      }

      const result = await pool.query(
        `SELECT
          er.id,
          er.score,
          er.total_marks,
          er.percentage,
          er.passed,
          er.created_at,
          e.title as exam_title,
          e.id as exam_id,
          s.name as subject_name
        FROM exam_results er
        JOIN exams e ON er.exam_id = e.id
        JOIN subjects s ON e.subject_id = s.id
        ${whereClause}
        ORDER BY er.created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, perPage, offset]
      );

      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM exam_results er ${whereClause}`,
        [...params]
      );

      res.json({
        success: true,
        results: result.rows,
        pagination: {
          page,
          perPage,
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(parseInt(countResult.rows[0].total) / perPage)
        }
      });
    } catch (error) {
      console.error('Error fetching current student results:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Student starts exam
router.post(
  '/start/:examId',
  verifyToken,
  [body('examId').isInt().toInt()],
  async (req, res) => {
    try {
      const studentId = req.user.id;
      const examId = req.params.examId;

      // Get exam details
      const examResult = await pool.query(
        `SELECT id, total_marks, max_attempts, allow_multiple_attempts FROM exams
        WHERE id = ? AND visibility = true AND deleted_at IS NULL`,
        [examId]
      );

      if (examResult.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Exam not found' } });
      }

      const exam = examResult.rows[0];

      // Check max attempts if enabled
      if (exam.allow_multiple_attempts && exam.max_attempts) {
        const attemptsResult = await pool.query(
          `SELECT COUNT(*) as attempts FROM exam_attempts
          WHERE student_id = ? AND exam_id = ? AND status = 'submitted'`,
          [studentId, examId]
        );

        if (attemptsResult.rows[0].attempts >= exam.max_attempts) {
          return res.status(403).json({
            error: { status: 403, message: 'Maximum attempts reached' }
          });
        }
      }

      // Create exam attempt
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

// Store an answer during the exam
router.post(
  '/:attemptId/answer',
  verifyToken,
  [
    body('questionId').isInt().toInt(),
    body('answer').notEmpty()
  ],
  async (req, res) => {
    try {
      const studentId = req.user.id;
      const attemptId = req.params.attemptId;
      const { questionId, answer } = req.body;

      const attemptResult = await pool.query(
        `SELECT id, exam_id, student_id FROM exam_attempts
        WHERE id = ? AND student_id = ? AND status = 'in_progress'`,
        [attemptId, studentId]
      );

      if (attemptResult.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Attempt not found' } });
      }

      const answerMatch = await pool.query(
        `SELECT id FROM answers WHERE question_id = ? AND answer_text = ? LIMIT 1`,
        [questionId, String(answer)]
      );

      if (answerMatch.rows.length === 0) {
        return res.status(400).json({ error: { status: 400, message: 'Answer not recognized' } });
      }

      await pool.query(
        `INSERT INTO exam_answers (attempt_id, question_id, selected_answer_id)
        VALUES (?, ?, ?)
        INSERT OR IGNORE`,
        [attemptId, questionId, answerMatch.rows[0].id]
      );

      res.json({ success: true, message: 'Answer recorded' });
    } catch (error) {
      console.error('Error recording answer:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Finish exam attempt
router.post(
  '/:attemptId/finish',
  verifyToken,
  async (req, res) => {
    try {
      const studentId = req.user.id;
      const attemptId = req.params.attemptId;

      const attemptResult = await pool.query(
        `SELECT ea.id, ea.exam_id, ea.student_id, e.total_marks, e.passing_mark, e.show_results_immediately
        FROM exam_attempts ea
        JOIN exams e ON ea.exam_id = e.id
        WHERE ea.id = ? AND ea.student_id = ? AND ea.status = 'in_progress'`,
        [attemptId, studentId]
      );

      if (attemptResult.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Attempt not found' } });
      }

      const { exam_id: examId, total_marks: totalMarks, passing_mark: passingMark, show_results_immediately: showResults } = attemptResult.rows[0];

      const savedAnswers = await pool.query(
        `SELECT ea.question_id, ea.selected_answer_id
        FROM exam_answers ea
        WHERE ea.attempt_id = ?`,
        [attemptId]
      );

      let score = 0;
      for (const answer of savedAnswers.rows) {
        const correctResult = await pool.query(
          `SELECT q.marks FROM answers a
          JOIN questions q ON a.question_id = q.id
          WHERE a.id = ? AND a.is_correct = true AND q.id = ?`,
          [answer.selected_answer_id, answer.question_id]
        );

        if (correctResult.rows.length > 0) {
          score += correctResult.rows[0].marks;
        }
      }

      await pool.query(
        `UPDATE exam_attempts SET status = 'submitted', submitted_at = datetime('now') WHERE id = ?`,
        [attemptId]
      );

      const percentage = Math.round((score / totalMarks) * 100);
      const passed = passingMark ? score >= passingMark : true;

      const resultResult = await pool.query(
        `INSERT INTO exam_results (attempt_id, student_id, exam_id, score, total_marks, percentage, passed)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING id, score, total_marks, percentage, passed`,
        [attemptId, studentId, examId, score, totalMarks, percentage, passed]
      );

      const result = resultResult.rows[0];

      await pool.query(
        `INSERT INTO notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [studentId, 'exam', 'Exam Submitted', `Your exam has been submitted. Score: ${score}/${totalMarks}`, 'exam_result', result.id]
      );

      res.json({
        success: true,
        result: showResults ? result : null,
        message: 'Exam submitted successfully'
      });
    } catch (error) {
      console.error('Error finishing exam:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Submit exam answers
router.post(
  '/submit/:attemptId',
  verifyToken,
  [
    body('answers').isArray().notEmpty(),
    body('answers.*.questionId').isInt().toInt(),
    body('answers.*.selectedAnswerId').optional().isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const studentId = req.user.id;
      const attemptId = req.params.attemptId;
      const { answers } = req.body;

      // Get attempt
      const attemptResult = await pool.query(
        `SELECT ea.id, ea.exam_id, ea.student_id, e.total_marks, e.passing_mark, e.show_results_immediately
        FROM exam_attempts ea
        JOIN exams e ON ea.exam_id = e.id
        WHERE ea.id = ? AND ea.student_id = ? AND ea.status = 'in_progress'`,
        [attemptId, studentId]
      );

      if (attemptResult.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Attempt not found' } });
      }

      const { exam_id: examId, total_marks: totalMarks, passing_mark: passingMark, show_results_immediately: showResults } = attemptResult.rows[0];

      // Store answers
      for (const answer of answers) {
        await pool.query(
          `INSERT INTO exam_answers (attempt_id, question_id, selected_answer_id)
          VALUES (?, ?, ?)`,
          [attemptId, answer.questionId, answer.selectedAnswerId]
        );
      }

      // Calculate score
      let score = 0;
      for (const answer of answers) {
        const correctResult = await pool.query(
          `SELECT q.marks FROM answers a
          JOIN questions q ON a.question_id = q.id
          WHERE a.id = ? AND a.is_correct = true AND q.id = ?`,
          [answer.selectedAnswerId, answer.questionId]
        );

        if (correctResult.rows.length > 0) {
          score += correctResult.rows[0].marks;
        }
      }

      // Mark attempt as submitted
      await pool.query(
        `UPDATE exam_attempts SET status = 'submitted', submitted_at = datetime('now')
        WHERE id = ?`,
        [attemptId]
      );

      // Create result
      const percentage = Math.round((score / totalMarks) * 100);
      const passed = passingMark ? score >= passingMark : true;

      const resultResult = await pool.query(
        `INSERT INTO exam_results (attempt_id, student_id, exam_id, score, total_marks, percentage, passed)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING id, score, percentage, passed`,
        [attemptId, studentId, examId, score, totalMarks, percentage, passed]
      );

      const result = resultResult.rows[0];

      // Create notification
      await pool.query(
        `INSERT INTO notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [studentId, 'exam', 'Exam Submitted', `Your exam has been submitted. Score: ${score}/${totalMarks}`, 'exam_result', result.id]
      );

      res.json({
        success: true,
        result: showResults ? result : null,
        message: 'Exam submitted successfully'
      });
    } catch (error) {
      console.error('Error submitting exam:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Get student's exam results
router.get(
  '/results/student/:studentId',
  verifyToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req, res) => {
    try {
      const userId = req.user.id;
      const studentId = req.params.studentId;

      // Students can only view their own results
      if (req.user.role === 'student' && userId !== parseInt(studentId)) {
        return res.status(403).json({
          error: { status: 403, message: 'Cannot view other student results' }
        });
      }

      const page = req.query.page || 1;
      const perPage = req.query.perPage || 20;
      const offset = (page - 1) * perPage;

      // Get results
      const result = await pool.query(
        `SELECT
          er.id,
          er.score,
          er.total_marks,
          er.percentage,
          er.passed,
          er.created_at,
          e.title as exam_title,
          e.id as exam_id,
          s.name as subject_name
        FROM exam_results er
        JOIN exams e ON er.exam_id = e.id
        JOIN subjects s ON e.subject_id = s.id
        WHERE er.student_id = ?
        ORDER BY er.created_at DESC
        LIMIT ? OFFSET ?`,
        [studentId, perPage, offset]
      );

      // Get total count
      const countResult = await pool.query(
        'SELECT COUNT(*) as total FROM exam_results WHERE student_id = ?',
        [studentId]
      );

      res.json({
        success: true,
        results: result.rows,
        pagination: {
          page,
          perPage,
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(parseInt(countResult.rows[0].total) / perPage)
        }
      });
    } catch (error) {
      console.error('Error fetching results:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Admin: Get results by exam
router.get(
  '/admin/exam/:examId',
  verifyToken,
  requireAdmin,
  requirePermission('view_results'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req, res) => {
    try {
      const examId = req.params.examId;
      const page = req.query.page || 1;
      const perPage = req.query.perPage || 20;
      const offset = (page - 1) * perPage;

      // Get results
      const result = await pool.query(
        `SELECT
          er.id,
          er.student_id,
          u.name as student_name,
          er.score,
          er.total_marks,
          er.percentage,
          er.passed,
          er.created_at
        FROM exam_results er
        JOIN users u ON er.student_id = u.id
        WHERE er.exam_id = ?
        ORDER BY er.percentage DESC, er.created_at DESC
        LIMIT ? OFFSET ?`,
        [examId, perPage, offset]
      );

      // Get statistics
      const statsResult = await pool.query(
        `SELECT
          COUNT(*) as total_attempts,
          AVG(percentage) as avg_percentage,
          MAX(percentage) as max_percentage,
          MIN(percentage) as min_percentage,
          SUM(CASE WHEN passed = true THEN 1 ELSE 0 END) as passed_count
        FROM exam_results WHERE exam_id = ?`,
        [examId]
      );

      res.json({
        success: true,
        results: result.rows,
        statistics: statsResult.rows[0],
        pagination: {
          page,
          perPage,
          total: parseInt(statsResult.rows[0].total_attempts)
        }
      });
    } catch (error) {
      console.error('Error fetching exam results:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

module.exports = router;
