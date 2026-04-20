import asyncio
from app.core.jira_client import JiraClient
import json

async def main():
    client = JiraClient()
    board_id = 1078
    sprints = await client.get_sprints(board_id)
    
    s52_back_id = next((s["id"] for s in sprints if "Sprint 52" in s["name"] and "Back" in s["name"]), None)
    print("S52 Back ID:", s52_back_id)
    
    if s52_back_id:
        rep = await client.get_sprint_report(board_id, s52_back_id)
        contents = rep.get("contents", {})
        print("issuesCompletedInAnotherSprint:")
        for i in contents.get("issuesCompletedInAnotherSprint", []):
            print(f" - {i['key']} ({i['summary']})")

asyncio.run(main())
