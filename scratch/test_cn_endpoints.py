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
    # 1. Featured (trending/movie/day -> discover/movie)
    "featured (discover/movie)": f"discover/movie?api_key={API_KEY}&sort_by=primary_release_date.desc&with_origin_country=CN&watch_region=CN&region=CN&primary_release_date.gte=2015-01-01&vote_count.gte=7",
    # 2. Popular (movie/popular -> discover/movie)
    "popular (discover/movie)": f"discover/movie?api_key={API_KEY}&sort_by=primary_release_date.desc&with_origin_country=CN&watch_region=CN&region=CN&primary_release_date.gte=2015-01-01&vote_count.gte=7",
    # 3. New to the marquee (movie/now_playing -> discover/movie)
    "new (discover/movie)": f"discover/movie?api_key={API_KEY}&sort_by=primary_release_date.desc&with_origin_country=CN&watch_region=CN&region=CN&primary_release_date.gte={gte_date}&primary_release_date.lte={lte_date}&vote_count.gte=7",
    # 4. Series in rotation (trending/tv/day -> discover/tv)
    "series (discover/tv)": f"discover/tv?api_key={API_KEY}&sort_by=first_air_date.desc&with_origin_country=CN&watch_region=CN&region=CN&without_genres=10767,10763,10766&first_air_date.gte=2015-01-01&vote_count.gte=7",
    # 5. Airing this week (tv/on_the_air -> discover/tv)
    "airing_this_week (discover/tv)": f"discover/tv?api_key={API_KEY}&sort_by=first_air_date.desc&with_origin_country=CN&watch_region=CN&region=CN&without_genres=10767,10763,10766&first_air_date.gte={gte_date}&first_air_date.lte={lte_date}&vote_count.gte=7"
}

for name, query in endpoints.items():
    full_url = f"{BASE_URL}{query}"
    print(f"Testing: {name}")
    print(f"URL: {full_url}")
    try:
        req = urllib.request.Request(full_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            results = data.get('results', [])
            print(f"  Count: {len(results)}")
            # Filter and sort simulation matching useAxios response interceptor
            filtered = [r for r in results if r.get('vote_count', 0) >= 7]
            print(f"  Count (vote_count >= 7): {len(filtered)}")
            if len(filtered) > 0:
                print(f"  Top 3 results after filter:")
                for i, item in enumerate(filtered[:3]):
                    title = item.get('title') or item.get('name')
                    rel_date = item.get('release_date') or item.get('first_air_date')
                    votes = item.get('vote_count')
                    print(f"    {i+1}. {title} ({rel_date}), votes: {votes}, poster: {item.get('poster_path')}, backdrop: {item.get('backdrop_path')}")
            else:
                print("  NO RESULTS")
    except Exception as e:
        print(f"  Error: {e}")
    print("-" * 50)
