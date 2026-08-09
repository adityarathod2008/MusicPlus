import yt_dlp
import requests

ydl_opts = {
    'format': 'bestaudio/best',
    'quiet': True
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info("https://www.youtube.com/watch?v=81qmmlsIE3k", download=False)
    url = info.get('url')
    headers = info.get('http_headers', {})
    print("Headers from yt-dlp:", headers)
    
    # Try fetching the stream
    print("Testing requests.get...")
    try:
        req = requests.get(url, headers=headers, stream=True, timeout=5)
        print("Status:", req.status_code)
        print("Content-Type:", req.headers.get('Content-Type'))
        print("Content-Length:", req.headers.get('Content-Length'))
    except Exception as e:
        print("Failed:", e)
