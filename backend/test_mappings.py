import asyncio
from app.core.jira_client import JiraClient
import json

async def main():
    client = JiraClient()
    types = await client._get(f"{client.base_url}/rest/api/2/issuetype")
    prios = await client._get(f"{client.base_url}/rest/api/2/priority")
    
    print("Types:", [{t['id']: t['name']} for t in types][:3])
    print("Prios:", [{p['id']: p['name']} for p in prios][:3])

asyncio.run(main())
