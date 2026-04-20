import asyncio
from app.core.jira_client import JiraClient
import json

async def main():
    client = JiraClient()
    r = await client._get(f"{client.base_url}/rest/api/2/issue/AGOM-124", params={"expand": "names"})
    names = r.get("names", {})
    # Find which customfield is "Sprint"
    for k, v in names.items():
        if "Sprint" in v or "sprint" in v.lower():
            print(f"Sprint Field found: {k} -> {v}")
            # Also print its value
            print("Value:", json.dumps(r.get("fields", {}).get(k), indent=2))

asyncio.run(main())
