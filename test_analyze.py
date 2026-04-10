import sys
sys.path.append('/home/flink/Documentos/Graficos-GP/backend')
import asyncio
from app.api.v1.endpoints.midia import analyze_health_reports
from app.core.config import get_settings

async def main():
    try:
        res = await analyze_health_reports([])
        rows = res.get('tableRows', [])
        print(f"✅ Se encontraron {len(rows)} productos.")
        for r in rows:
            print(f" - {r['label']} (key: {r['key']})")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(main())
