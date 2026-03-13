"""
Service para leer el calendario de equipo desde Confluence
y extraer personas, roles, equipos, vacaciones y cumpleaños.
"""
import re
from datetime import date, datetime
from typing import Optional
from html.parser import HTMLParser
import httpx

from app.core.config import get_settings # <-- Agregamos tu configurador

settings = get_settings() # <-- Instanciamos las variables

def _headers():
    return {
        "Authorization": f"Bearer {settings.confluence_pat}", # <-- Usamos el .env
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

async def fetch_page_html() -> str:
    """Obtiene el HTML de la página de Confluence."""
    # Usamos las variables del .env para la URL y el ID
    url = f"{settings.confluence_base_url}/rest/api/content/{settings.confluence_page_id}?expand=body.storage"
    async with httpx.AsyncClient(timeout=10, verify=False) as client:
        resp = await client.get(url, headers=_headers())
        resp.raise_for_status()
        data = resp.json()
        return data["body"]["storage"]["value"]


class TableParser(HTMLParser):
    """Parser simple para extraer tablas HTML de Confluence."""

    def __init__(self):
        super().__init__()
        self.tables = []
        self._current_table = []
        self._current_row = []
        self._current_cell = ""
        self._in_cell = False
        self._depth = 0

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self._current_table = []
            self._depth += 1
        elif tag in ("tr",):
            self._current_row = []
        elif tag in ("td", "th"):
            self._in_cell = True
            self._current_cell = ""

    def handle_endtag(self, tag):
        if tag == "table":
            self.tables.append(self._current_table)
            self._current_table = []
            self._depth -= 1
        elif tag == "tr":
            if self._current_row:
                self._current_table.append(self._current_row)
            self._current_row = []
        elif tag in ("td", "th"):
            self._in_cell = False
            self._current_row.append(self._current_cell.strip())
            self._current_cell = ""

    def handle_data(self, data):
        if self._in_cell:
            self._current_cell += data


def _parse_date(s: str, year: int) -> Optional[date]:
    """Intenta parsear una fecha en varios formatos comunes."""
    s = s.strip()
    if not s:
        return None
    formats = [
        "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d",
        "%d/%m/%y", "%d de %B", "%d/%m",
        "%B %d", "%b %d",
    ]
    for fmt in formats:
        try:
            d = datetime.strptime(s, fmt)
            # Si no tiene año, usamos el año actual
            if d.year == 1900:
                d = d.replace(year=year)
            return d.date()
        except ValueError:
            continue
    return None


def _normalize_dates(text: str, year: int):
    """
    Extrae rangos de fechas de strings como:
    '15/01 - 30/01', '3 al 10 de marzo', '10/02/2026', etc.
    Retorna (start_date, end_date) o None
    """
    text = text.strip()
    if not text or text in ("-", "—", ""):
        return None

    # Rango con guión: 15/01 - 30/01
    range_match = re.search(r'(\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?)\s*[-–al]+\s*(\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?)', text)
    if range_match:
        start = _parse_date(range_match.group(1), year)
        end   = _parse_date(range_match.group(2), year)
        if start and end:
            return start, end

    # Rango "3 al 10 de marzo"
    range_text = re.search(r'(\d{1,2})\s+al\s+(\d{1,2})\s+de\s+(\w+)', text, re.IGNORECASE)
    if range_text:
        months_es = {"enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,
                     "julio":7,"agosto":8,"septiembre":9,"octubre":10,"noviembre":11,"diciembre":12}
        m = months_es.get(range_text.group(3).lower())
        if m:
            try:
                start = date(year, m, int(range_text.group(1)))
                end   = date(year, m, int(range_text.group(2)))
                return start, end
            except ValueError:
                pass

    # Fecha única
    d = _parse_date(text, year)
    if d:
        return d, d

    return None


async def get_team_people() -> list[dict]:
    """
    Parsea la página de Confluence y retorna lista de personas con:
    nombre, equipo, rol, vacaciones [(start, end)], cumpleaños
    """
    html = await fetch_page_html()
    parser = TableParser()
    parser.feed(html)

    people = []
    year = date.today().year

    for table in parser.tables:
        if len(table) < 2:
            continue

        # Detectar headers
        headers = [h.lower().strip() for h in table[0]]

        # Mapear columnas
        col = {}
        for i, h in enumerate(headers):
            if any(k in h for k in ["nombre", "name", "persona"]):
                col["name"] = i
            elif any(k in h for k in ["equipo", "team", "área", "area"]):
                col["team"] = i
            elif any(k in h for k in ["rol", "role", "puesto", "cargo"]):
                col["role"] = i
            elif any(k in h for k in ["vacacion", "vacation", "ausencia", "licencia"]):
                col["vacation"] = i
            elif any(k in h for k in ["cumple", "birthday", "nacimiento"]):
                col["birthday"] = i

        if "name" not in col:
            continue

        for row in table[1:]:
            if not row or not row[col["name"]].strip():
                continue

            person = {
                "name":      row[col["name"]].strip() if "name" in col and col["name"] < len(row) else "",
                "team":      row[col["team"]].strip()  if "team" in col and col["team"] < len(row) else "",
                "role":      row[col["role"]].strip()  if "role" in col and col["role"] < len(row) else "",
                "vacations": [],
                "birthday":  None,
            }

            # Vacaciones — puede ser múltiples rangos separados por coma o salto de línea
            if "vacation" in col and col["vacation"] < len(row):
                vac_text = row[col["vacation"]]
                for chunk in re.split(r'[,\n;]', vac_text):
                    result = _normalize_dates(chunk.strip(), year)
                    if result:
                        person["vacations"].append({
                            "start": result[0].isoformat(),
                            "end":   result[1].isoformat(),
                        })

            # Cumpleaños
            if "birthday" in col and col["birthday"] < len(row):
                result = _normalize_dates(row[col["birthday"]], year)
                if result:
                    person["birthday"] = result[0].isoformat()

            if person["name"]:
                people.append(person)

    return people


async def get_availability_by_date(target_date: str, team: Optional[str] = None) -> dict:
    """
    Para una fecha dada, retorna quién está disponible y quién no.
    """
    people = await get_team_people()
    available = []
    unavailable = []

    for p in people:
        if team and p["team"] and team.lower() not in p["team"].lower():
            continue

        on_vacation = any(
            v["start"] <= target_date <= v["end"]
            for v in p["vacations"]
        )

        if on_vacation:
            unavailable.append(p)
        else:
            available.append(p)

    return {
        "date": target_date,
        "team": team,
        "available_count":   len(available),
        "unavailable_count": len(unavailable),
        "available":   available,
        "unavailable": unavailable,
    }
