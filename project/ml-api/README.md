---
title: LICIN
colorFrom: blue
colorTo: pink
sdk: docker
app_port: 7860
---

# LICIN API

FastAPI server wrapping a YOLO model for acne detection.

## Deploy to Hugging Face Spaces

1. Go to https://huggingface.co/new-space
2. Space name: `licin`
3. License: `mit`
4. Space SDK: **Docker**
5. Upload all files from this directory (`ml-api/`) via git or drag & drop
6. Space auto-builds and deploys

## Local Dev

```bash
pip install -r requirements.txt
cp ../MachineLearning/best.pt .
uvicorn main:app --reload --port 8002
```

## API

```
GET  /health          → { "status": "ok" }
POST /analyze         → multipart form: file=<image>
```

Response:
```json
{
  "markers": [{ "id": "dark_spot_0", "label": "Dark Spot", "x": "45.2", "y": "33.7", "severity": 2 }],
  "acne_counts": { "dark spot": 3, "blackheads": 1 },
  "health_score": { "clear_skin": 87.0 },
  "product": { "name": "Dark Spot Corrector", "description": "..." },
  "issues_found": ["dark spot", "blackheads"]
}
```
