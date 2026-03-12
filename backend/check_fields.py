"""
Script para detectar el campo de story points en tu Jira.
Corre esto en tu máquina dentro del venv:
  python check_fields.py
"""
import asyncio, httpx, os
from dotenv import load_dotenv

load_dotenv(".env")

PAT = os.getenv("JIRA_PAT")
BASE = os.getenv("JIRA_BASE_URL").rstrip("/")
PROJECT = os.getenv("JIRA_PROJECT_KEY")
SPRINT_ID = 1686  # Sprint 52 Back

headers = {
    "Authorization": f"Bearer {PAT}",
    "Accept": "application/json",
}

async def main():
    async with httpx.AsyncClient(timeout=30) as client:
        # Traer un issue del sprint con todos sus campos
        r = await client.get(
            f"{BASE}/rest/agile/1.0/sprint/{SPRINT_ID}/issue",
            headers=headers,
            params={"maxResults": 1, "fields": "*all"}
        )
        data = r.json()
        issues = data.get("issues", [])
        if not issues:
            print("No issues found")
            return

        issue = issues[0]
        fields = issue["fields"]
        print(f"\nIssue: {issue['key']} - {fields.get('summary','')}")
        print("\n=== Campos con 'point', 'story', 'estimate' en el nombre ===")
        for k, v in fields.items():
            if v is not None and isinstance(v, (int, float, str)):
                kl = k.lower()
                if any(x in kl for x in ["Points", "Story", "estimate", "sp", "size"]):
                    print(f"  {k}: {v}")

        print("\n=== Todos los customfields con valor numérico ===")
        for k, v in fields.items():
            if k.startswith("customfield_") and isinstance(v, (int, float)) and v is not None:
                print(f"  {k}: {v}")

asyncio.run(main())
