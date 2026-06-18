import urllib.request
import json

API_KEY = 'dfa4c2c7c1de1005adee824dc5593672'
BASE_URL = 'https://api.themoviedb.org/3/'

headers_to_test = [
    # 1. Normal headers
    {
        "name": "Default Python Headers",
        "headers": {'User-Agent': 'Mozilla/5.0'}
    },
    # 2. Browser headers simulating localhost origin
    {
        "name": "Localhost Origin",
        "headers": {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'http://localhost:5173',
            'Referer': 'http://localhost:5173/'
        }
    },
    # 3. Browser headers simulating production origin
    {
        "name": "Production Origin",
        "headers": {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://moovie.fun',
            'Referer': 'https://moovie.fun/'
        }
    },
    # 4. Chinese Accept-Language header
    {
        "name": "Accept-Language zh-CN",
        "headers": {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }
    }
]

query = f"discover/movie?api_key={API_KEY}&sort_by=primary_release_date.desc&with_origin_country=CN&watch_region=CN&region=CN&primary_release_date.gte=2015-01-01&vote_count.gte=7"
full_url = f"{BASE_URL}{query}"

for t in headers_to_test:
    print(f"Testing: {t['name']}")
    try:
        req = urllib.request.Request(full_url, headers=t['headers'])
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            results = data.get('results', [])
            print(f"  Status: {response.status}, Results count: {len(results)}")
    except Exception as e:
        print(f"  Error: {e}")
    print("-" * 50)
