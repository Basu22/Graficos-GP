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
    sprint_id = 1958 # Sprint 57 Back
    rep = await client.get_sprint_report(board_id, sprint_id)
    contents = rep.get("contents", {})
    added_keys = contents.get("issueKeysAddedDuringSprint", {})
    
    if type(added_keys) is not dict:
        print("added_keys is not dict, it is:", type(added_keys))

    completed = contents.get("completedIssues", [])
    pending = contents.get("issuesNotCompletedInCurrentSprint", [])
    
    def calculate_scope_creep(issue_list):
        creep = 0.0
        for i in issue_list:
            key = i.get("key", "")
            curr = get_issue_points(i)
            # wait.. if added_keys is a dict:
            try:
                is_added = added_keys.get(key)
            except AttributeError:
                is_added = key in added_keys
            init = 0.0 if is_added else get_issue_points(i.get("estimateStatistic", {}))
            creep += max(0, curr - init)
        return creep

    comp_pts = get_sum_value(contents.get("completedIssuesEstimateSum"))
    pend_pts = get_sum_value(contents.get("issuesNotCompletedEstimateSum"))
    punted_pts = get_sum_value(contents.get("puntedIssuesEstimateSum"))
    
    creep_comp = calculate_scope_creep(completed)
    creep_pend = calculate_scope_creep(pending)
    total_creep = creep_comp + creep_pend
    
    print(f"comp: {comp_pts}, pend: {pend_pts}, punted: {punted_pts}")
    print(f"creep_comp: {creep_comp}, creep_pend: {creep_pend}, total_creep: {total_creep}")
    ans = max(0, (comp_pts + pend_pts + punted_pts) - total_creep)
    print("Ans committed:", ans)

asyncio.run(main())
