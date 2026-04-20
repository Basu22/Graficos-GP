import asyncio
from app.core.jira_client import JiraClient

def get_sum_value(stat_dict):
    if not stat_dict: return 0.0
    try: return float(stat_dict.get("value", 0) or 0)
    except (ValueError, TypeError): return 0.0

def get_issue_points(issue):
    stat = issue.get("currentEstimateStatistic")
    if not stat: return 0.0
    val = stat.get("statFieldValue")
    if not val: return 0.0
    try: return float(val.get("value", 0) or 0)
    except (ValueError, TypeError): return 0.0

async def main():
    client = JiraClient()
    board_id = 1078
    sprint = {"id": 1958, "committed": 0, "delivered": 0}
    try:
        rep = await client.get_sprint_report(board_id, sprint["id"])
        contents = rep.get("contents", {})
        added_keys = contents.get("issueKeysAddedDuringSprint", {})

        completed = contents.get("completedIssues", [])
        pending = contents.get("issuesNotCompletedInCurrentSprint", [])
        punted = contents.get("puntedIssues", [])

        def calculate_scope_creep(issue_list):
            creep = 0.0
            for i in issue_list:
                key = i.get("key", "")
                curr = get_issue_points(i)
                init = 0.0 if added_keys.get(key) else get_issue_points(i.get("estimateStatistic", {}))
                creep += max(0, curr - init)
            return creep

        comp_pts = get_sum_value(contents.get("completedIssuesEstimateSum"))
        pend_pts = get_sum_value(contents.get("issuesNotCompletedEstimateSum"))
        punted_pts = get_sum_value(contents.get("puntedIssuesEstimateSum"))
        
        total_creep = calculate_scope_creep(completed) + calculate_scope_creep(pending)
        
        sprint["committed"] = max(0, (comp_pts + pend_pts + punted_pts) - total_creep)
        sprint["delivered"] = comp_pts
        print("Success:", sprint)
    except Exception as e:
        print("EXCEPTION:", repr(e))
        import traceback
        traceback.print_exc()

asyncio.run(main())
