# Smart Student Analytics & Performance Prediction

A beginner-friendly full-stack portfolio project:

- React + Vite frontend (deploy on Vercel)
- Node.js + Express REST API (deploy on Render)
- PostgreSQL database (Neon)
- Python + FastAPI + scikit-learn prediction service (deploy on Render)

## Features

- Create, list, update, and delete student records
- Dashboard statistics
- Predict a student's final mark using a Random Forest regression model
- Store prediction history in PostgreSQL
- Display performance and risk indicators

> **Important:** The included training dataset is synthetic demo data. It is only for learning the deployment and integration workflow. It is not a validated educational assessment model and must not be used for real academic decisions. Replace it with a properly collected, consented, representative dataset and evaluate it before real use.

> **Security scope:** This learning MVP does not include user authentication or role-based access. Do not store sensitive student data or expose it as a public production system until authentication, authorization, rate limiting, validation, backups, and privacy controls are added.

---

## 1. Architecture

```text
React (Vercel)
    |
    | HTTPS / JSON
    v
Node.js + Express (Render)
    |                 |
    | SQL             | HTTP request
    v                 v
Neon PostgreSQL    FastAPI + scikit-learn (Render)
                       |
                       v
                 prediction result
```

The browser talks only to the Node API. Node stores records in Neon and calls the separate Python ML API for predictions.

## 2. Run locally

Requirements:
- Git
- Node.js 20+
- Python 3.10+
- A Neon PostgreSQL database (or local PostgreSQL)

### A. Create the Neon database

1. Create an account at https://neon.com/
2. Create a project and database.
3. Open the SQL Editor.
4. Run the complete contents of `database/schema.sql`.
5. Copy the connection string from the Neon dashboard. Keep it secret.

### B. Start the ML API

Open a terminal in the project root:

```bash
cd ml
python -m venv .venv
```

Windows PowerShell:
```powershell
.venv\Scripts\Activate.ps1
```

macOS/Linux:
```bash
source .venv/bin/activate
```

Install and run:
```bash
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Check:
- http://localhost:8000/health
- http://localhost:8000/docs

### C. Start the Node backend

Open a second terminal:

```bash
cd backend
```

Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL`: Neon connection string
- `ML_API_URL`: `http://localhost:8000`
- `FRONTEND_URL`: `http://localhost:5173`

Then:
```bash
npm install
npm run dev
```

Check:
- http://localhost:5000/api/health
- http://localhost:5000/api/stats

### D. Start the React frontend

Open a third terminal:

```bash
cd frontend
```

Copy `.env.example` to `.env`:

```env
VITE_API_URL=http://localhost:5000
```

Then:
```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually http://localhost:5173.

---

## 3. Deploy Neon + ML + Backend + Frontend

### A. Push the project to GitHub

Create a new empty GitHub repository. From the project root:

```bash
git init
git add .
git commit -m "Initial smart student analytics project"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Do not commit `.env` files or secrets. The `.gitignore` is included.

### B. Neon

1. Create a Neon project.
2. Run `database/schema.sql` in Neon SQL Editor.
3. Copy the PostgreSQL connection string.
4. Use it as `DATABASE_URL` in the Render backend service.
5. Keep the connection string private. Use SSL; the backend config enables SSL for hosted URLs.

### C. Deploy the ML API on Render

1. In Render, create **New → Web Service** and connect the GitHub repository.
2. Set **Root Directory** to `ml`.
3. Runtime: Python.
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
6. Deploy and copy the service URL, for example `https://your-ml-service.onrender.com`.

The service trains the demo model from `training_data.csv` when it starts.

### D. Deploy the Node API on Render

1. Create another **New → Web Service** using the same repository.
2. Set **Root Directory** to `backend`.
3. Runtime: Node.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Add environment variables:

```env
NODE_ENV=production
DATABASE_URL=YOUR_NEON_CONNECTION_STRING
ML_API_URL=https://your-ml-service.onrender.com
FRONTEND_URL=https://your-frontend.vercel.app
```

You can set `FRONTEND_URL` after creating the Vercel project, then redeploy the backend.

7. Deploy and copy the backend URL, e.g. `https://your-api.onrender.com`.
8. Test `https://your-api.onrender.com/api/health`.

### E. Deploy the frontend on Vercel

1. Import the GitHub repository into Vercel.
2. Set **Root Directory** to `frontend`.
3. Framework preset: Vite.
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Add environment variable:

```env
VITE_API_URL=https://your-api.onrender.com
```

7. Deploy.
8. Copy the Vercel URL and set it as `FRONTEND_URL` in the Render backend service.
9. Redeploy the backend so CORS allows your frontend origin.

### F. Final test

- Open the Vercel website.
- Add a student.
- Confirm the student appears in the list and dashboard count changes.
- Select **Predict** for that student.
- Confirm a prediction is saved and displayed.
- Refresh the page and confirm records remain in Neon.

Free hosting services may sleep, pause, or have usage limits. First requests after idle time may take longer. Check current plan limits on each provider's official pricing page.

---

## 4. API reference

Base URL: `http://localhost:5000` (local) or your Render backend URL.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | API health |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/students` | List students |
| GET | `/api/students/:id` | One student |
| POST | `/api/students` | Create student |
| PUT | `/api/students/:id` | Update student |
| DELETE | `/api/students/:id` | Delete student and prediction history |
| POST | `/api/predict/:id` | Predict and save final mark |
| GET | `/api/predictions/:studentId` | Prediction history |

ML service:
- `GET /health`
- `POST /predict`
- Interactive API docs: `/docs`

## 5. Suggested next improvements

1. Add JWT authentication and Admin/Teacher roles.
2. Add pagination, search, and server-side validation.
3. Replace synthetic demo data with a real, consented dataset.
4. Evaluate MAE/RMSE and compare multiple models before trusting predictions.
5. Add automated tests and database backups.
6. Add audit logs and privacy controls.
