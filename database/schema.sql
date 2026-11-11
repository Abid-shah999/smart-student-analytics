CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    attendance NUMERIC(5,2) NOT NULL CHECK (attendance >= 0 AND attendance <= 100),
    previous_marks NUMERIC(5,2) NOT NULL CHECK (previous_marks >= 0 AND previous_marks <= 100),
    assignment_marks NUMERIC(5,2) NOT NULL CHECK (assignment_marks >= 0 AND assignment_marks <= 100),
    study_hours NUMERIC(5,2) NOT NULL CHECK (study_hours >= 0 AND study_hours <= 24),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    predicted_marks NUMERIC(5,2) NOT NULL,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('Low', 'Moderate', 'High')),
    model_name VARCHAR(100) NOT NULL DEFAULT 'RandomForestRegressor-demo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_student_id
ON predictions(student_id);
