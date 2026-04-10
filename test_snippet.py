import sys
sys.path.append('/home/flink/Documentos/Graficos-GP/backend')
import asyncio, json
from app.api.v1.endpoints.midia import analyze_health_reports

async def main():
    res = await analyze_health_reports([])
    print("--- SNIPPET ---")
    print(res.get('latestSnippet', 'VACIO'))
    print("--- AI ANALYSIS ---")
    print(res.get('aiAnalysis', 'VACIO'))

if __name__ == '__main__':
    asyncio.run(main())
