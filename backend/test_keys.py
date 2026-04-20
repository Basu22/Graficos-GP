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
        contents = rep.get("contents", {})
        issues = contents.get("completedIssues", [])
        if issues:
            print(json.dumps(issues[0], indent=2))

asyncio.run(main())
