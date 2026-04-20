import asyncio
from app.core.jira_client import JiraClient

async def main():
    client = JiraClient()
    sprint_id = 1958 # Sprint 57 Back
    rep = await client.get_sprint_report(1078, sprint_id)
    contents = rep.get("contents", {})
    
    comp = contents.get("completedIssuesEstimateSum")
    print("comp raw:", comp)
    
asyncio.run(main())
