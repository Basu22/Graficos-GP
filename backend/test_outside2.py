import asyncio
from app.core.jira_client import JiraClient
import json

async def main():
    client = JiraClient()
    board_id = 1078
    sprint_id = 1687  # S52 Datos
    rep = await client.get_sprint_report(board_id, sprint_id)
    contents = rep.get("contents", {})
    
    print(json.dumps(contents.get("issuesCompletedInAnotherSprint", []), indent=2))
    print("---")
    print("puntedIssues:", len(contents.get("puntedIssues", [])))
    print("issueKeysAddedDuringSprint:", len(contents.get("issueKeysAddedDuringSprint", {})))

asyncio.run(main())
