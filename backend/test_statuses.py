import asyncio
from app.core.jira_client import JiraClient
import json

async def main():
    client = JiraClient()
    statuses = await client._get(f"{client.base_url}/rest/api/2/status")
    print(f"Total statuses found: {len(statuses)}")
    # Find status with id 10001
    for s in statuses:
        if s.get("id") == "10001":
            print(f"Status 10001 is: {s.get('name')} (Category: {s.get('statusCategory', {}).get('name')})")
            
asyncio.run(main())
