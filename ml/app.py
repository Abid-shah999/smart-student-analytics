from pathlib import Path
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "training_data.csv"
FEATURES = ["attendance", "previous_marks", "assignment_marks", "study_hours"]

app = FastAPI(
    title="Smart Student Analytics ML API",
    description="Demo-only academic mark prediction API trained on synthetic data.",
    version="1.0.0"
)

model = None
model_mae = None
MODEL_NAME = "RandomForestRegressor-demo"

class PredictionInput(BaseModel):
    attendance: float = Field(ge=0, le=100)
    previous_marks: float = Field(ge=0, le=100)
    assignment_marks: float = Field(ge=0, le=100)
    study_hours: float = Field(ge=0, le=24)

@app.on_event("startup")
def train_model():
    global model, model_mae
    data = pd.read_csv(DATA_PATH)
    X = data[FEATURES]
    y = data["final_marks"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    model = RandomForestRegressor(
        n_estimators=150,
        random_state=42,
        max_depth=6
    )
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    model_mae = round(float(mean_absolute_error(y_test, predictions)), 2)
    print(f"Demo model trained. Holdout MAE: {model_mae}")

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "model_name": MODEL_NAME,
        "demo_holdout_mae": model_mae
    }

@app.post("/predict")
def predict(payload: PredictionInput):
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not ready.")
    row = pd.DataFrame([payload.model_dump()], columns=FEATURES)
    predicted = float(model.predict(row)[0])
    predicted = max(0.0, min(100.0, predicted))

    if predicted < 50:
        risk = "High"
    elif predicted < 70:
        risk = "Moderate"
    else:
        risk = "Low"

    return {
        "predicted_marks": round(predicted, 2),
        "risk_level": risk,
        "model_name": MODEL_NAME,
        "demo_only": True,
        "model_mae": model_mae
    }
