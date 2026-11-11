import { useEffect, useMemo, useState } from "react";
import { Activity, BrainCircuit, GraduationCap, Plus, RefreshCw, Search, Trash2, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
const emptyForm = {
  name: "", email: "", attendance: "85", previous_marks: "70",
  assignment_marks: "75", study_hours: "3"
};

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || "Request failed");
  return data;
}

function StatCard({ icon: Icon, label, value, note }) {
  return <div className="stat-card">
    <div className="stat-top"><span>{label}</span><span className="icon-wrap"><Icon size={19}/></span></div>
    <strong>{value}</strong><small>{note}</small>
  </div>;
}

export default function App() {
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({ total_students: 0, average_marks: 0, low_attendance: 0, total_predictions: 0 });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [latestPrediction, setLatestPrediction] = useState(null);

  async function loadData() {
    try {
      const [studentData, statsData] = await Promise.all([
        request("/api/students"), request("/api/stats")
      ]);
      setStudents(studentData);
      setStats(statsData);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => students.filter(student =>
    student.name.toLowerCase().includes(search.toLowerCase()) ||
    student.email.toLowerCase().includes(search.toLowerCase())
  ), [students, search]);

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submitStudent(event) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage(""); setLatestPrediction(null);
    const payload = {
      ...form,
      attendance: Number(form.attendance),
      previous_marks: Number(form.previous_marks),
      assignment_marks: Number(form.assignment_marks),
      study_hours: Number(form.study_hours)
    };
    try {
      await request(editingId ? `/api/students/${editingId}` : "/api/students", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      setMessage(editingId ? "Student updated successfully." : "Student added successfully.");
      setForm(emptyForm); setEditingId(null);
      await loadData();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function editStudent(student) {
    setEditingId(student.id);
    setForm({
      name: student.name, email: student.email,
      attendance: String(student.attendance), previous_marks: String(student.previous_marks),
      assignment_marks: String(student.assignment_marks), study_hours: String(student.study_hours)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteStudent(id) {
    if (!window.confirm("Delete this student and their prediction history?")) return;
    setError(""); setMessage("");
    try {
      await request(`/api/students/${id}`, { method: "DELETE" });
      setMessage("Student deleted.");
      await loadData();
    } catch (err) { setError(err.message); }
  }

  async function predict(student) {
    setBusy(true); setError(""); setMessage(""); setLatestPrediction(null);
    try {
      const result = await request(`/api/predict/${student.id}`, { method: "POST" });
      setLatestPrediction({ ...result, studentName: student.name });
      setMessage(`Prediction completed for ${student.name}.`);
      await loadData();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><GraduationCap size={22}/></div><div><b>Smart Student</b><small>Analytics platform</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <a className="nav-item active"><Activity size={18}/> Overview</a>
      <a className="nav-item"><Users size={18}/> Students</a>
      <a className="nav-item"><BrainCircuit size={18}/> ML Predictions</a>
      <div className="sidebar-bottom"><span className="status-dot"></span> API-connected dashboard</div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div><p className="eyebrow">STUDENT MANAGEMENT / OVERVIEW</p><h1>Dashboard</h1></div>
        <button className="secondary-btn" onClick={loadData}><RefreshCw size={16}/> Refresh</button>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <section className="stats-grid">
        <StatCard icon={Users} label="Total students" value={stats.total_students} note="Saved in Neon PostgreSQL"/>
        <StatCard icon={Activity} label="Average marks" value={`${stats.average_marks}%`} note="Average of previous and assignment marks"/>
        <StatCard icon={GraduationCap} label="Low attendance" value={stats.low_attendance} note="Students below 75% attendance"/>
        <StatCard icon={BrainCircuit} label="Predictions made" value={stats.total_predictions} note="Prediction records saved"/>
      </section>

      <section className="content-grid">
        <div className="panel form-panel">
          <div className="panel-heading"><div><span className="eyebrow">STUDENT RECORD</span><h2>{editingId ? "Update student" : "Add a student"}</h2></div><span className="round-icon"><Plus size={18}/></span></div>
          <form onSubmit={submitStudent}>
            <label>Full name<input name="name" value={form.name} onChange={updateField} placeholder="e.g. Alex Morgan" required maxLength="120"/></label>
            <label>Email address<input name="email" type="email" value={form.email} onChange={updateField} placeholder="alex@example.com" required/></label>
            <div className="form-row">
              <label>Attendance (%)<input name="attendance" type="number" min="0" max="100" step="0.1" value={form.attendance} onChange={updateField} required/></label>
              <label>Previous marks<input name="previous_marks" type="number" min="0" max="100" step="0.1" value={form.previous_marks} onChange={updateField} required/></label>
            </div>
            <div className="form-row">
              <label>Assignment marks<input name="assignment_marks" type="number" min="0" max="100" step="0.1" value={form.assignment_marks} onChange={updateField} required/></label>
              <label>Study hours/day<input name="study_hours" type="number" min="0" max="24" step="0.1" value={form.study_hours} onChange={updateField} required/></label>
            </div>
            <button className="primary-btn full" disabled={busy}>{busy ? "Please wait..." : editingId ? "Save changes" : "Add student"}</button>
            {editingId && <button type="button" className="text-btn" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel editing</button>}
          </form>
        </div>

        <div className="panel chart-panel">
          <div className="panel-heading"><div><span className="eyebrow">CLASS SNAPSHOT</span><h2>Academic overview</h2></div><span className="round-icon purple"><Activity size={18}/></span></div>
          {students.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={students.slice(0, 8).map(s => ({ name: s.name.split(" ")[0], Previous: Number(s.previous_marks), Assignment: Number(s.assignment_marks) }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5"/>
              <XAxis dataKey="name" tickLine={false} axisLine={false}/>
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false}/>
              <Tooltip/>
              <Bar dataKey="Previous" fill="#8b9cf7" radius={[5,5,0,0]}/>
              <Bar dataKey="Assignment" fill="#35b7a1" radius={[5,5,0,0]}/>
            </BarChart>
          </ResponsiveContainer></div> : <div className="empty-chart">Add students to see the class chart.</div>}
          <div className="chart-legend"><span><i className="legend-a"></i> Previous marks</span><span><i className="legend-b"></i> Assignment marks</span></div>
        </div>
      </section>

      {latestPrediction && <section className="prediction-result panel">
        <div><span className="eyebrow">LATEST ML RESULT · DEMO MODEL</span><h2>{latestPrediction.studentName}</h2><p>Predicted final marks</p></div>
        <strong>{Number(latestPrediction.predicted_marks).toFixed(1)}<small>/100</small></strong>
        <span className={`risk ${latestPrediction.risk_level.toLowerCase()}`}>{latestPrediction.risk_level} risk</span>
      </section>}

      <section className="panel table-panel">
        <div className="panel-heading table-heading"><div><span className="eyebrow">DATABASE RECORDS</span><h2>Students</h2></div>
          <div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students..."/></div>
        </div>
        <div className="table-scroll"><table>
          <thead><tr><th>Student</th><th>Attendance</th><th>Previous</th><th>Assignment</th><th>Study hrs</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(student => <tr key={student.id}>
              <td><div className="student-cell"><span className="avatar">{student.name.slice(0,1).toUpperCase()}</span><div><b>{student.name}</b><small>{student.email}</small></div></div></td>
              <td>{Number(student.attendance).toFixed(1)}%</td>
              <td>{Number(student.previous_marks).toFixed(1)}</td>
              <td>{Number(student.assignment_marks).toFixed(1)}</td>
              <td>{Number(student.study_hours).toFixed(1)}h</td>
              <td><div className="actions"><button className="predict-btn" disabled={busy} onClick={() => predict(student)}><BrainCircuit size={14}/> Predict</button><button className="icon-btn" title="Edit" onClick={() => editStudent(student)}>Edit</button><button className="icon-btn danger" title="Delete" onClick={() => deleteStudent(student.id)}><Trash2 size={15}/></button></div></td>
            </tr>)}
            {!filtered.length && <tr><td colSpan="6" className="empty-row">No students found. Add your first student above.</td></tr>}
          </tbody>
        </table></div>
        <div className="table-footer">Showing {filtered.length} of {students.length} students · Demo ML predictions are not for real academic decisions.</div>
      </section>
      <footer>Smart Student Analytics <span>Full Stack + Machine Learning learning project</span></footer>
    </main>
  </div>;
}
