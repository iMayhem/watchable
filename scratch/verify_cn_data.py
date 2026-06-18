import urllib.request
import json
from datetime import datetime, timedelta

API_KEY = 'dfa4c2c7c1de1005adee824dc5593672'
BASE_URL = 'https://api.themoviedb.org/3/'

def get_recent_date_range():
    today = datetime.now()
    six_months_ago = today - timedelta(days=180)
    return six_months_ago.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')

gte_date, lte_date = get_recent_date_range()

endpoints = {
    "featured": f"discover/movie?api_key={API_KEY}&sort_by=primary_release_date.desc&with_origin_country=CN&watch_region=CN&region=CN&primary_release_date.gte=2015-01-01&vote_count.gte=7",
    "popular": f"discover/movie?api_key={API_KEY}&sort_by=primary_release_date.desc&with_origin_country=CN&watch_region=CN&region=CN&primary_release_date.gte=2015-01-01&vote_count.gte=7",
    "new": f"discover/movie?api_key={API_KEY}&sort_by=primary_release_date.desc&with_origin_country=CN&watch_region=CN&region=CN&primary_release_date.gte={gte_date}&primary_release_date.lte={lte_date}&vote_count.gte=7",
    "series": f"discover/tv?api_key={API_KEY}&sort_by=first_air_date.desc&with_origin_country=CN&watch_region=CN&region=CN&without_genres=10767,10763,10766&first_air_date.gte=2015-01-01&vote_count.gte=7",
    "airing_this_week": f"discover/tv?api_key={API_KEY}&sort_by=first_air_date.desc&with_origin_country=CN&watch_region=CN&region=CN&without_genres=10767,10763,10766&first_air_date.gte={gte_date}&first_air_date.lte={lte_date}&vote_count.gte=7"
}

for name, query in endpoints.items():
    full_url = f"{BASE_URL}{query}"
    print(f"=== {name.upper()} ===")
    try:
        req = urllib.request.Request(full_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            results = data.get('results', [])
            print(f"Count: {len(results)}")
            for idx, item in enumerate(results):
                title = item.get('title') or item.get('name')
                poster = item.get('poster_path')
                backdrop = item.get('backdrop_path')
                rel_date = item.get('release_date') or item.get('first_air_date')
                votes = item.get('vote_count')
                avg = item.get('vote_average')
                
                # Check for missing/null values
                issues = []
                if not poster:
                    issues.append("missing poster")
                if not backdrop:
                    issues.append("missing backdrop")
                if not rel_date:
                    issues.append("missing release date")
                
                issues_str = f" [ISSUES: {', '.join(issues)}]" if issues else ""
                print(f"  {idx+1}. {title} ({rel_date}), votes: {votes}, avg: {avg}{issues_str}")
    except Exception as e:
        print(f"  Error: {e}")
    print("\n" + "=" * 50 + "\n")
