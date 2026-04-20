import asyncio
from app.core.jira_client import JiraClient
import json

async def main():
    client = JiraClient()
    board_id = 1078
    sprints = await client.get_sprints(board_id)
    s56_id = next((s["id"] for s in sprints if "Sprint 56" in s["name"] and "Back" in s["name"]), None)
    
    if s56_id:
        rep = await client.get_sprint_report(board_id, s56_id)
        # Contents doesn't have it. Let's check the root of the report
        print("Root keys:", rep.keys())
        contents = rep.get("contents", {})
        print("Contents keys:", contents.keys())

asyncio.run(main())
