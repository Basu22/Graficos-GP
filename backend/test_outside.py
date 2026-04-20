import asyncio
from app.core.jira_client import JiraClient
import json

async def main():
    client = JiraClient()
    board_id = 1078
    sprint_id = 1687  # S52 from previous log
    rep = await client.get_sprint_report(board_id, sprint_id)
    contents = rep.get("contents", {})
    
    # Let's print all keys in contents to see if there is an array for "terminadas fuera de este sprint"
    for k, v in contents.items():
        if isinstance(v, list) and len(v) > 0:
            print(f"List Field: {k} (Length: {len(v)})")
            # See if AGOM-117 is in this list
            for issue in v:
                if issue.get("key") == "AGOM-117":
                    print(f" -> FOUND AGOM-117 IN {k}")

asyncio.run(main())
