import asyncio
from app.core.jira_client import JiraClient
import json

async def main():
    client = JiraClient()
    issues = await client.get_issues_for_sprint(1965) # I don't know the exact ID, let's use the Greenhopper search
    # wait, earlier we found S52 id in test_carryover.py: it was 1687 (id of board maybe?)
    # Wait, in test_carryover, test_velocity we saw: Sprint 52 is not printed! We started from S54 in recent.
    # We can just fetch S52 from get_sprints directly.
    sprints = await client.get_sprints(1078)
    s52_id = next((s["id"] for s in sprints if "Sprint 52" in s["name"] and "Datos" in s["name"]), None)
    print("S52 ID:", s52_id)
    if s52_id:
        issues = await client.get_issues_for_sprint(s52_id, fields=["*all"])
        for i in issues:
            if i["key"] in ("AGOM-124"):
                print("Fields for AGOM-124:")
                for k, v in i["fields"].items():
                    if v and type(v) == list:
                        print(f"{k}: {v}")
asyncio.run(main())
