import asyncio
from app.core.jira_client import JiraClient
import json

async def main():
    client = JiraClient()
    board_id = 1078
    sprint_id = 1959  # Sprint 57 Datos (from earlier test_velocity.py output: id=1959, name="OfertaMin - Datos - Sprint 57")
    
    res = await client.get_sprint_report(board_id, sprint_id)
    contents = res.get("contents", {})
    
    # Let's find AGOM-1372 in completedIssues
    target_issue = None
    for issue in contents.get("completedIssues", []):
        if issue.get("key") == "AGOM-1372":
            target_issue = issue
            break
            
    if not target_issue:
        for issue in contents.get("issuesNotCompletedInCurrentSprint", []):
            if issue.get("key") == "AGOM-1372":
                target_issue = issue
                break
                
    print("AGOM-1372 Data:")
    print(json.dumps(target_issue, indent=2) if target_issue else "Not found")
    
    print("\nKeys inside issueKeysAddedDuringSprint:")
    print(json.dumps(contents.get("issueKeysAddedDuringSprint", {}), indent=2))
    
    print("\nEstimate Sums:")
    print("allIssuesEstimateSum:", contents.get("allIssuesEstimateSum"))
    print("completedIssuesEstimateSum:", contents.get("completedIssuesEstimateSum"))
    print("issuesNotCompletedEstimateSum:", contents.get("issuesNotCompletedEstimateSum"))
    
    # Are there any global keys for estimate changes?
    print("\nRoot Keys mentioning 'Estimate':")
    for k in contents.keys():
        if "Estimate" in k:
            print(f"{k}: {contents[k]}")
            
    # Let's dump another issue that didn't change for comparison
    for issue in contents.get("completedIssues", []):
        if issue.get("key") == "AGOM-1382":
            print("\nAGOM-1382 Data (No change):")
            print(json.dumps({k: v for k, v in issue.items() if "Statistic" in k or k == "key"}, indent=2))
            break

asyncio.run(main())
