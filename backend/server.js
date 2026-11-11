import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const ML_API_URL = (process.env.ML_API_URL || "http://localhost:8000").replace(/\/$/, "");

app.use(express.json());

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(cors({
  origin(origin, callback) {
    // Permit tools such as curl/Postman (no Origin header) in this learning MVP.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  }
}));

function validateStudent(body) {
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const attendance = Number(body.attendance);
  const previous_marks = Number(body.previous_marks);
  const assignment_marks = Number(body.assignment_marks);
  const study_hours = Number(body.study_hours);

  if (!name || !email || !email.includes("@")) return { error: "Valid name and email are required." };
  if (![attendance, previous_marks, assignment_marks].every(v => Number.isFinite(v) && v >= 0 && v <= 100)) {
    return { error: "Attendance and marks must be between 0 and 100." };
  }
  if (!Number.isFinite(study_hours) || study_hours < 0 || study_hours > 24) {
    return { error: "Study hours must be between 0 and 24." };
  }
  return { value: { name, email, attendance, previous_marks, assignment_marks, study_hours } };
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Database connection failed." });
  }
});

app.get("/api/stats", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS total_students,
        COALESCE(ROUND(AVG((previous_marks + assignment_marks) / 2.0), 2), 0) AS average_marks,
        COUNT(*) FILTER (WHERE attendance < 75)::int AS low_attendance
      FROM students
    `);
    const predictions = await pool.query("SELECT COUNT(*)::int AS total_predictions FROM predictions");
    res.json({ ...result.rows[0], total_predictions: predictions.rows[0].total_predictions });
  } catch (error) {
    res.status(500).json({ error: "Could not load dashboard statistics." });
  }
});

app.get("/api/students", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM students ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Could not load students." });
  }
});

app.get("/api/students/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid student ID." });
  try {
    const result = await pool.query("SELECT * FROM students WHERE id = $1", [id]);
    if (!result.rowCount) return res.status(404).json({ error: "Student not found." });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Could not load student." });
  }
});

app.post("/api/students", async (req, res) => {
  const checked = validateStudent(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const s = checked.value;
  try {
    const result = await pool.query(
      `INSERT INTO students (name, email, attendance, previous_marks, assignment_marks, study_hours)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [s.name, s.email, s.attendance, s.previous_marks, s.assignment_marks, s.study_hours]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "That email is already registered." });
    res.status(500).json({ error: "Could not create student." });
  }
});

app.put("/api/students/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid student ID." });
  const checked = validateStudent(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const s = checked.value;
  try {
    const result = await pool.query(
      `UPDATE students SET name=$1, email=$2, attendance=$3, previous_marks=$4,
       assignment_marks=$5, study_hours=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [s.name, s.email, s.attendance, s.previous_marks, s.assignment_marks, s.study_hours, id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Student not found." });
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "That email is already registered." });
    res.status(500).json({ error: "Could not update student." });
  }
});

app.delete("/api/students/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid student ID." });
  try {
    const result = await pool.query("DELETE FROM students WHERE id=$1 RETURNING id", [id]);
    if (!result.rowCount) return res.status(404).json({ error: "Student not found." });
    res.json({ message: "Student deleted." });
  } catch {
    res.status(500).json({ error: "Could not delete student." });
  }
});

app.post("/api/predict/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid student ID." });
  try {
    const studentResult = await pool.query("SELECT * FROM students WHERE id=$1", [id]);
    if (!studentResult.rowCount) return res.status(404).json({ error: "Student not found." });
    const student = studentResult.rows[0];

    const mlResponse = await fetch(`${ML_API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attendance: Number(student.attendance),
        previous_marks: Number(student.previous_marks),
        assignment_marks: Number(student.assignment_marks),
        study_hours: Number(student.study_hours)
      })
    });

    if (!mlResponse.ok) {
      const details = await mlResponse.text();
      console.error("ML service error:", details);
      return res.status(502).json({ error: "ML service could not make a prediction. Check that the ML service is running." });
    }

    const prediction = await mlResponse.json();
    const saved = await pool.query(
      `INSERT INTO predictions (student_id, predicted_marks, risk_level, model_name)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, prediction.predicted_marks, prediction.risk_level, prediction.model_name]
    );
    res.status(201).json({ student_id: id, ...saved.rows[0] });
  } catch (error) {
    console.error("Prediction route error:", error.message);
    res.status(500).json({ error: "Prediction failed. Check backend, database, and ML service." });
  }
});

app.get("/api/predictions/:studentId", async (req, res) => {
  const id = Number(req.params.studentId);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid student ID." });
  try {
    const result = await pool.query(
      "SELECT * FROM predictions WHERE student_id=$1 ORDER BY created_at DESC",
      [id]
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Could not load prediction history." });
  }
});

app.use((error, _req, res, _next) => {
  console.error(error.message);
  res.status(500).json({ error: "Server error." });
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
