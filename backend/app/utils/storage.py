import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent.parent / "data"

def load_json(filename: str, default=[]):
    file_path = DATA_DIR / filename
    if not file_path.exists():
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(json.dumps(default))
    try:
        return json.loads(file_path.read_text())
    except:
        return default

def save_json(filename: str, data):
    file_path = DATA_DIR / filename
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
