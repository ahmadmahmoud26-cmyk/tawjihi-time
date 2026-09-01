const pool = require('../config/database');

const JORDAN_TIME_ZONE = 'Asia/Amman';

function getJordanDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JORDAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const partValue = (type) => parts.find((part) => part.type === type)?.value;

  return `${partValue('year')}-${partValue('month')}-${partValue('day')}`;
}

function getPreviousDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function calculateNextStreak(currentStreak, previousActivityDate, today) {
  if (previousActivityDate === today) {
    return Number(currentStreak || 0);
  }

  return previousActivityDate === getPreviousDate(today)
    ? Number(currentStreak || 0) + 1
    : 1;
}

async function recordStudentDailyActivity(studentId) {
  const today = getJordanDate();
  const existingResult = await pool.query(
    'SELECT current_streak, last_activity_date, last_login_at FROM student_streaks WHERE student_id = ?',
    [studentId]
  );
  const existing = existingResult?.rows?.[0];

  if (!existing) {
    await pool.query(
      `INSERT INTO student_streaks (student_id, current_streak, last_activity_date, last_login_at, created_at, updated_at)
       VALUES (?, 1, ?, datetime('now'), datetime('now'), datetime('now'))`,
      [studentId, today]
    );
    return 1;
  }

  const previousActivityDate = existing.last_activity_date
    || (existing.last_login_at ? getJordanDate(new Date(`${existing.last_login_at.replace(' ', 'T')}Z`)) : null);

  const nextStreak = calculateNextStreak(existing.current_streak, previousActivityDate, today);

  await pool.query(
    `UPDATE student_streaks
     SET current_streak = ?, last_activity_date = ?, last_login_at = datetime('now'), updated_at = datetime('now')
     WHERE student_id = ?`,
    [nextStreak, today, studentId]
  );

  return nextStreak;
}

module.exports = { calculateNextStreak, getJordanDate, getPreviousDate, recordStudentDailyActivity };
