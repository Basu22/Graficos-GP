import asyncio
from app.core.jira_client import JiraClient
import json

async def main():
    client = JiraClient()
    board_id = await client.get_board_id()
    # Fetch velocity data
    url = f"{client.base_url}/rest/greenhopper/1.0/rapid/charts/velocity"
    params = {"rapidViewId": board_id}
    res = await client._get(url, params)
    print(json.dumps(res.get("velocityStatEntries", {}), indent=2)[:2000])

asyncio.run(main())
