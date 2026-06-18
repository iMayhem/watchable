import urllib.request

images = [
    "/zP19YO60jwEsfKd5Qf1UvA5uJu8.jpg", # The Furious Poster
    "/ew3EqF9VLTxmK64OsHT7p7lr4wT.jpg", # The Furious Backdrop
    "/digyHMNMAljJZnCm6GSuWcOo4fw.jpg", # Cold War 1994 Poster
    "/izha2mBeBHfCIniJCibpJIUovy0.jpg", # Cold War 1994 Backdrop
]

for img in images:
    # Test w500, w780, original
    for size in ["w500", "w780", "original"]:
        url = f"https://image.tmdb.org/t/p/{size}{img}"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                print(f"URL: {url} -> Status: {response.status}, Size: {len(response.read())} bytes")
        except Exception as e:
            print(f"URL: {url} -> Error: {e}")
    print("-" * 50)
