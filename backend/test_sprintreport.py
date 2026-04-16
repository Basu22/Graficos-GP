import asyncio
from app.core.jira_client import JiraClient
import json

async def main():
    client = JiraClient()
    board_id = 1078
    sprint_id = 1958
    res = await client.get_sprint_report(board_id, sprint_id)
    contents = res.get("contents", {})
    
    print("Sprint Report Keys:", contents.keys())
    print("\nissueKeysAddedDuringSprint:", len(contents.get("issueKeysAddedDuringSprint", {})))
    print("completedIssuesEstimateSum:", contents.get("completedIssuesEstimateSum"))
    print("issuesNotCompletedEstimateSum:", contents.get("issuesNotCompletedEstimateSum"))
    print("puntedIssuesEstimateSum:", contents.get("puntedIssuesEstimateSum"))
    print("allIssuesEstimateSum:", contents.get("allIssuesEstimateSum"))

asyncio.run(main())
