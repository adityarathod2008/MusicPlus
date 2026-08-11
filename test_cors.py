import requests

try:
    r = requests.get("https://5c529603aab9bc.lhr.life/stream/LUgpPmj6nR8", stream=True)
    print(r.status_code)
    print(r.headers)
except Exception as e:
    print(e)
