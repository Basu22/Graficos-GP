import asyncio
from app.core.config import get_settings
from app.core.jira_client import JiraClient
import json

async def main():
    client = JiraClient()
    board_id = await client.get_board_id()
    # Let's take sprint 1848 which failed in logs
    res = await client.get_sprint_report(board_id, 1848)
    print(json.dumps(res, indent=2)[:500])
    
    contents = res.get("contents", {})
    completed_est = contents.get("completedIssuesEstimateSum")
    print("completedIssuesEstimateSum:", completed_est)
    
    # Simulate map_issue
    if contents.get("completedIssues"):
        i = contents["completedIssues"][0]
        cur_est = i.get("currentEstimateStatistic")
        print("Issue currentEstimateStatistic:", cur_est)

asyncio.run(main())
