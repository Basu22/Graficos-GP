import asyncio
from app.core.jira_client import JiraClient

def get_issue_points(issue):
    stat = issue.get("currentEstimateStatistic")
    if not stat: return 0.0
    val = stat.get("statFieldValue")
    if not val: return 0.0
    try: return float(val.get("value", 0) or 0)
    except (ValueError, TypeError): return 0.0

async def main():
    client = JiraClient()
    sprint_id = 1958 # Sprint 57 Back
    rep = await client.get_sprint_report(1078, sprint_id)
    contents = rep.get("contents", {})
    
    added_keys = contents.get("issueKeysAddedDuringSprint", {})
    completed = contents.get("completedIssues", [])
    
    creep = 0.0
    for i in completed:
        key = i.get("key", "")
        curr = get_issue_points(i)
        
        stat_init = i.get("estimateStatistic", {})
        val_init = stat_init.get("statFieldValue") if stat_init else None
        value_init = float(val_init.get("value", 0) or 0) if val_init else 0.0
        
        init = 0.0 if added_keys.get(key) else value_init
        
        if curr != init:
            print(f"Creep found in {key}: {init} -> {curr} (added={bool(added_keys.get(key))})")
        
        creep += max(0, curr - init)
        
    print("Total Creep (completed):", creep)
    
asyncio.run(main())
