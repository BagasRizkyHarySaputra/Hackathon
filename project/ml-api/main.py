"""
LICIN - YOLO Skin Analysis API (FastAPI)

Accepts an image, runs YOLO inference, returns:
  - markers (bounding box positions for overlay)
  - health_score (full Skin Health Score Profile %)
  - annotated_image (base64 JPEG with bounding boxes drawn)
  - product (dummy recommendation)
  - acne_counts (raw detection counts)

Endpoints:
  GET  /health        -> { status: "ok" }
  POST /analyze       -> structured analysis result

Run (HTTP):
  uvicorn main:app --reload --port 8002

Run (HTTPS - recommended for mixed-content fix):
  python main.py    <-- auto-detects SSL certs in project root
  OR
  uvicorn main:app --host 0.0.0.0 --port 8002 \\
    --ssl-keyfile ../localhost+3-key.pem \\
    --ssl-certfile ../localhost+3.pem
"""

import base64
import io
import os
import ssl

from fastapi import FastAPI, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLO

from recommendation_engine import RecommendationEngine

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="LICIN API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Model & Recommendation Engine
# ---------------------------------------------------------------------------
MODEL_PATH = os.environ.get("MODEL_PATH", "best.pt")
model = YOLO(MODEL_PATH)

# Initialize recommendation engine (loads pagi.json & malam.json)
recommender = RecommendationEngine()

# Weight per acne type for health score calculation (same as scan.py)
CLASS_WEIGHTS = {
    "nodules": 15,
    "pustules": 10,
    "papules": 5,
    "dark spot": 2,
    "blackheads": 2,
    "whiteheads": 2,
}

# All expected acne types (for zero-fill when not detected)
ALL_CLASSES = ["nodules", "pustules", "papules", "dark spot", "blackheads", "whiteheads"]

# 9-Grid face zone mapping (3x3 grid)
FACE_ZONES = {
    0: "Dahi Kiri",
    1: "Dahi Tengah",
    2: "Dahi Kanan",
    3: "Pipi Kiri",
    4: "Hidung/T-zone",
    5: "Pipi Kanan",
    6: "Dagu Kiri",
    7: "Dagu Tengah",
    8: "Dagu Kanan",
}


# ---------------------------------------------------------------------------
# Grid detection helper
# ---------------------------------------------------------------------------
def get_grid_cell(cx: float, cy: float) -> int:
    """
    Map center coordinates (cx, cy) in percentage (0-100) to a 3×3 grid cell (0-8).
    
    Grid layout:
      [0] [1] [2]    (top row: y < 33.33)
      [3] [4] [5]    (mid row: 33.33 ≤ y < 66.67)
      [6] [7] [8]    (bottom row: y ≥ 66.67)
    
    Column: x < 33.33 (left), 33.33 ≤ x < 66.67 (center), x ≥ 66.67 (right)
    """
    # Determine row (0=top, 1=mid, 2=bottom)
    if cy < 33.33:
        row = 0
    elif cy < 66.67:
        row = 1
    else:
        row = 2
    
    # Determine column (0=left, 1=center, 2=right)
    if cx < 33.33:
        col = 0
    elif cx < 66.67:
        col = 1
    else:
        col = 2
    
    return row * 3 + col


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    budget: str = Query("standard", regex="^(economy|standard|premium)$")
):
    """Accept an image file -> run YOLO -> return structured analysis results."""

    # Read + open image
    image_data = await file.read()
    image = Image.open(io.BytesIO(image_data)).convert("RGB")
    img_w, img_h = image.size

    # Run inference
    results = model.predict(
        source=image,
        save=False,
        conf=0.15,
        iou=0.5,
        imgsz=1280,
        augment=True,
        max_det=300,
        verbose=False,
    )
    result = results[0]

    # Build class name lookup
    class_names = model.names  # dict[int, str]

    acne_counts: dict[str, int] = {}
    markers: list[dict] = []
    grid_counts: dict[int, int] = {}  # Count acne per grid cell

    if result.boxes is not None:
        for box in result.boxes:
            class_id = int(box.cls[0])
            class_name: str = class_names[class_id]
            acne_counts[class_name] = acne_counts.get(class_name, 0) + 1

            # Convert bounding-box center to percentage coordinates
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            cx = ((x1 + x2) / 2) / img_w * 100
            cy = ((y1 + y2) / 2) / img_h * 100

            # Determine grid cell and face zone
            grid_id = get_grid_cell(cx, cy)
            face_zone = FACE_ZONES[grid_id]
            grid_counts[grid_id] = grid_counts.get(grid_id, 0) + 1

            markers.append({
                "id": f"{class_name}_{len(markers)}",
                "label": class_name.title(),
                "x": f"{cx:.1f}",
                "y": f"{cy:.1f}",
                "severity": CLASS_WEIGHTS.get(class_name, 2),
                "grid_id": grid_id,
                "face_zone": face_zone,
            })

    # ---------------------------------------------------------------
    # Annotated image with bounding boxes (YOLO result.plot())
    # ---------------------------------------------------------------
    annotated_array = result.plot(line_width=1, font_size=5)  # thin boxes + small text
    # Convert BGR -> RGB for PIL
    annotated_array = annotated_array[:, :, ::-1]
    annotated_pil = Image.fromarray(annotated_array)
    buf = io.BytesIO()
    annotated_pil.save(buf, format="JPEG", quality=85)
    annotated_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

    # ---------------------------------------------------------------
    # Health score profile (matches scan.py logic exactly)
    # ---------------------------------------------------------------
    total_penalty = sum(
        count * CLASS_WEIGHTS.get(acne_type, 2)
        for acne_type, count in acne_counts.items()
    )
    clear_skin = max(5, 100 - total_penalty)
    actual_acne_burden = 100 - clear_skin

    # Build weighted scores per detected type
    weighted_scores = {}
    for acne_type, count in acne_counts.items():
        weighted_scores[acne_type] = count * CLASS_WEIGHTS.get(acne_type, 2)

    # Build full health score profile
    health_score = {"clear_skin": round(clear_skin, 1)}

    if actual_acne_burden > 0 and total_penalty > 0:
        # Distribute actual_acne_burden proportionally across detected types
        for acne_type, penalty_part in weighted_scores.items():
            share = (penalty_part / total_penalty) * actual_acne_burden
            health_score[acne_type] = round(share, 1)
    # Zero-fill any classes not detected
    for cls in ALL_CLASSES:
        if cls not in health_score:
            health_score[cls] = 0.0

    # Build grid statistics with face zone names
    grid_stats = [
        {
            "grid_id": grid_id,
            "face_zone": FACE_ZONES[grid_id],
            "acne_count": grid_counts.get(grid_id, 0),
        }
        for grid_id in range(9)
    ]

    # Generate product recommendations based on analysis
    total_acne = sum(acne_counts.values())
    ml_result = {
        "total_acne": total_acne,
        "acne_counts": acne_counts,
        "issues_found": list(acne_counts.keys()),
        "grid_stats": grid_stats,
    }
    recommendations = recommender.generate_recommendations(ml_result, budget_level=budget)

    return {
        "markers": markers,
        "acne_counts": acne_counts,
        "health_score": health_score,
        "annotated_image": annotated_b64,
        "recommendations": recommendations,
        "issues_found": list(acne_counts.keys()),
        "grid_stats": grid_stats,
    }


# ---------------------------------------------------------------------------
# Entry point (supports HTTPS via local SSL certs)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    cert_file = os.path.join(project_root, "localhost+3.pem")
    key_file = os.path.join(project_root, "localhost+3-key.pem")

    ssl_kwargs = {}
    if os.path.exists(cert_file) and os.path.exists(key_file):
        ssl_kwargs = {
            "ssl_certfile": cert_file,
            "ssl_keyfile": key_file,
        }
        print("[ML API] SSL certificates found — serving HTTPS on port 8002")
    else:
        print("[ML API] SSL certificates not found — serving HTTP on port 8002")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        **ssl_kwargs,
    )
