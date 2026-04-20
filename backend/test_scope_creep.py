import asyncio
from app.core.jira_client import JiraClient
import json

async def main():
    client = JiraClient()
    board_id = 1078
    # Looking at user's screenshot: Sprint 52 (OfertaMin - Back - Sprint 52). We need its sprint ID.
    # Let's just fetch sprints and find Sprint 52.
    sprints = await client.get_sprints(board_id)
    s52_id = next((s["id"] for s in sprints if "Sprint 52" in s["name"] and "Back" in s["name"]), None)
    
    if s52_id:
        res = await client.get_sprint_report(board_id, s52_id)
        contents = res.get("contents", {})
        added = contents.get("issueKeysAddedDuringSprint", {})
        print("issueKeysAddedDuringSprint:", json.dumps(added, indent=2))
        
        # Let's also check the structure of completedIssues to see if there is an indicator there
        issues = contents.get("completedIssues", [])
        if issues:
            print("Sample Issue keys:", [i["key"] for i in issues])
    else:
        print("Sprint 52 not found")

asyncio.run(main())
