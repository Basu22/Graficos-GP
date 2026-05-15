import asyncio
from backend.app.core.jira_client import JiraClient
from backend.app.api.v1.endpoints.sprints import RECURRENT_TEMPLATES

async def main():
    client = JiraClient()
    sprint_number = 61
    for t_list in RECURRENT_TEMPLATES.values():
        for tpl in t_list:
            title = tpl["summary"].format(n=sprint_number)
            safe_title = title.replace('"', '\\"')
            jql = f'project = AGOM AND summary ~ "{safe_title}" AND issuetype = Tarea'
            issues = await client.search_issues_jql(jql)
            print(f"{tpl['key']}: {len(issues)} found")
            for i in issues:
                print(f"  -> {i['key']} - {i['fields']['summary']}")

asyncio.run(main())
