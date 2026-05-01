import asyncio
from app.core.jira_client import JiraClient
from app.core.config import get_settings

async def main():
    settings = get_settings()
    client = JiraClient()
    url = f"{client.base_url}/rest/api/2/user/search"
    
    print("Fetching user/search with username='@' startAt=0...")
    try:
        res1 = await client._get(url, {"username": "@", "maxResults": 100, "startAt": 0})
        print(f"Len 1 @: {len(res1)}")
    except Exception as e:
        pass

    print("Fetching user/search with username='@' startAt=100...")
    try:
        res2 = await client._get(url, {"username": "@", "maxResults": 100, "startAt": 100})
        print(f"Len 2 @: {len(res2)}")
    except Exception as e:
        pass

if __name__ == "__main__":
    asyncio.run(main())
