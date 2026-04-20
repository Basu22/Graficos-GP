import asyncio
from app.core.jira_client import JiraClient
import json

async def main():
    client = JiraClient()
    board_id = 1078
    
    # We need Sprint 52 Datos. Since we don't know the ID exactly, we fetch sprints
    sprints = await client.get_sprints(board_id)
    s52_id = next((s["id"] for s in sprints if "Sprint 52" in s["name"] and "Datos" in s["name"]), None)
    
    if not s52_id:
        print("S52 not found")
        return
        
    print(f"Loading Sprint {s52_id}")
    rep = await client.get_sprint_report(board_id, s52_id)
    contents = rep.get("contents", {})
    
    # Check AGOM-124 in completed
    for i in contents.get("completedIssues", []):
        if i.get("key") == "AGOM-124":
            print("Found AGOM-124 in S52 completedIssues:")
            print(json.dumps(i, indent=2))
            break
            
asyncio.run(main())
