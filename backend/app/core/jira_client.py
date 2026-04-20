import httpx
import time
from app.core.config import get_settings

settings = get_settings()

# Cache simple en memoria: {key: (timestamp, value)}
_cache: dict = {}
_locks: dict = {}
_http_client: httpx.AsyncClient | None = None

def get_http_client():
    global _http_client
    if _http_client is None:
        limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
        _http_client = httpx.AsyncClient(verify=False, timeout=45.0, limits=limits)
    return _http_client

def get_lock(key: str):
    import asyncio
    if key not in _locks:
        _locks[key] = asyncio.Lock()
    return _locks[key]


def _cache_get(key: str):
    if key in _cache:
        ts, val = _cache[key]
        if time.time() - ts < settings.cache_ttl:
            return val
        del _cache[key]
    return None


def _cache_set(key: str, val):
    _cache[key] = (time.time(), val)


class JiraClient:
    def __init__(self):
        self.base_url = settings.jira_base_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {settings.jira_pat}",
            "Content-Type": "application/json",
        }
        self._board_id = None

    async def _get(self, url: str, params: dict = None):
        cache_key = f"{url}|{sorted((params or {}).items())}"
        async with get_lock(cache_key):
            cached = _cache_get(cache_key)
            if cached is not None:
                return cached

            client = get_http_client()
            r = await client.get(url, headers=self.headers, params=params)
            r.raise_for_status()
            data = r.json()

            _cache_set(cache_key, data)
            return data

    async def get_board_id(self) -> int:
        if self._board_id:
            return self._board_id
        url = f"{self.base_url}/rest/agile/1.0/board"
        params = {"projectKeyOrId": settings.jira_project_key}
        data = await self._get(url, params)
        self._board_id = data["values"][0]["id"]
        return self._board_id

    async def get_sprints(self, board_id: int, state: str = "closed,active", team: str = None) -> list:
        cache_key = f"sprints|{board_id}|{state}|{team}"
        async with get_lock(cache_key):
            cached = _cache_get(cache_key)
            if cached is not None:
                return cached

            url = f"{self.base_url}/rest/agile/1.0/board/{board_id}/sprint"
            all_sprints, start = [], 0
            client = get_http_client()
            while True:
                r = await client.get(url, headers=self.headers,
                                     params={"state": state, "startAt": start, "maxResults": 50})
                r.raise_for_status()
                data = r.json()
                all_sprints.extend(data.get("values", []))
                if data.get("isLast", True):
                    break
                start += 50

            if team:
                all_sprints = [s for s in all_sprints if team.lower() in s.get("name", "").lower()]

            _cache_set(cache_key, all_sprints)
            return all_sprints

    async def get_issues_for_sprint(self, sprint_id: int, fields: list[str] = None, expand: str = None) -> list:
        cache_key = f"issues|{sprint_id}|{fields}|{expand}"
        async with get_lock(cache_key):
            cached = _cache_get(cache_key)
            if cached is not None:
                return cached

            default_fields = ["summary", "status", "assignee", "customfield_10006",
                              "issuetype", "created", "resolutiondate", "sprint"]
            use_fields = fields or default_fields

            url = f"{self.base_url}/rest/api/2/search"
            jql = f"sprint = {sprint_id} ORDER BY created ASC"
            all_issues, start = [], 0
            client = get_http_client()
            while True:
                params_dict = {
                    "jql": jql, "startAt": start, "maxResults": 100,
                    "fields": ",".join(use_fields),
                }
                if expand:
                    params_dict["expand"] = expand

                r = await client.get(url, headers=self.headers, params=params_dict)
                r.raise_for_status()
                data = r.json()
                all_issues.extend(data.get("issues", []))
                if start + len(data.get("issues", [])) >= data.get("total", 0):
                    break
                start += 100

            _cache_set(cache_key, all_issues)
            return all_issues

    async def get_issues_by_keys(self, keys: list[str], fields: list[str] = None) -> list:
        if not keys:
            return []
        
        # Batching en chunks de 50 para no reventar el JQL length limit
        default_fields = ["summary", "status", "assignee", "issuetype", "resolutiondate"]
        use_fields = fields or default_fields
        url = f"{self.base_url}/rest/api/2/search"
        client = get_http_client()
        all_issues = []

        chunk_size = 50
        for i in range(0, len(keys), chunk_size):
            chunk = keys[i:i + chunk_size]
            jql = f"issue IN ({','.join(chunk)})"
            
            try:
                r = await client.get(url, headers=self.headers, params={
                    "jql": jql, 
                    "maxResults": 100,
                    "fields": ",".join(use_fields),
                })
                r.raise_for_status()
                data = r.json()
                all_issues.extend(data.get("issues", []))
            except Exception as e:
                print(f"Error fetching batch keys {chunk}: {e}")

        return all_issues


    async def get_teams(self, board_id: int) -> list[str]:
        """Extrae equipos únicos desde los nombres de los sprints (ej: OfertaMin - Back - Sprint 47)"""
        sprints = await self.get_sprints(board_id, state="closed,active", team=None)
        teams = set()
        for s in sprints:
            parts = [p.strip() for p in s.get("name", "").split(" - ")]
            if len(parts) >= 2:
                teams.add(parts[1])
        return sorted(teams)
    async def get_sprint_report(self, board_id: int, sprint_id: int) -> dict:
        """Consulta el reporte de sprint nativo (Greenhopper) para obtener datos de burndown e incidencias."""
        url = f"{self.base_url}/rest/greenhopper/1.0/rapid/charts/sprintreport"
        params = {"rapidViewId": board_id, "sprintId": sprint_id}
        return await self._get(url, params)

    async def get_velocity_chart(self, board_id: int) -> dict:
        """Obtiene de Greenhopper el histórico inmutable de velocidad (Comprometido vs Terminado)."""
        url = f"{self.base_url}/rest/greenhopper/1.0/rapid/charts/velocity"
        params = {"rapidViewId": board_id}
        data = await self._get(url, params)
        return data.get("velocityStatEntries", {})

    async def get_statuses_map(self) -> dict:
        """Mapeo global de ID -> {name, category}"""
        url = f"{self.base_url}/rest/api/2/status"
        data = await self._get(url)
        return {s["id"]: {"name": s["name"], "category": s.get("statusCategory", {}).get("key", "todo")} for s in data}

    async def get_priorities_map(self) -> dict:
        """Mapeo global de ID -> name"""
        url = f"{self.base_url}/rest/api/2/priority"
        data = await self._get(url)
        return {p["id"]: p["name"] for p in data}

    async def get_issuetypes_map(self) -> dict:
        """Mapeo global de ID -> name"""
        url = f"{self.base_url}/rest/api/2/issuetype"
        data = await self._get(url)
        return {t["id"]: t["name"] for t in data}


async def get_jira_client():
    yield JiraClient()