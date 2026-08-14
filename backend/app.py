import os
from pathlib import Path
from flask import Flask, request, jsonify, redirect, Response
from flask_cors import CORS
import yt_dlp
import requests
import sqlite3
from datetime import datetime
import ytmusicapi
import sys

ytmusic = ytmusicapi.YTMusic()
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes so the frontend can hit this API

def get_base_path():
    try:
        return sys._MEIPASS
    except Exception:
        return os.path.dirname(os.path.dirname(__file__))

base_path = get_base_path()

from flask import send_from_directory

@app.route('/')
def serve_index():
    return send_from_directory(base_path, 'music_app.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(base_path, filename)


# Use /tmp for sqlite on Vercel, otherwise save to user's home directory to avoid dropping files randomly
if os.environ.get('VERCEL') == '1':
    DB_PATH = '/tmp/database.db'
else:
    app_dir = Path.home() / '.musicplus'
    app_dir.mkdir(parents=True, exist_ok=True)
    DB_PATH = str(app_dir / 'database.db')

# Temporary store for OTPs: { email: { 'otp': '123456', 'expires': timestamp } }
otp_store = {}

# Initialize SQLite Database
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            last_login TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

init_db()

@app.route('/api/sync-user', methods=['POST'])
def sync_user():
    data = request.json
    email = data.get('email')
    username = data.get('username')
    password = data.get('password')
    status = data.get('status', 'pending')
    
    if not email or not username:
        return jsonify({"error": "Missing user data"}), 400
        
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Check if user exists
        c.execute("SELECT id FROM users WHERE email=?", (email,))
        user = c.fetchone()
        
        if user:
            # Update existing user's last login and status
            c.execute("UPDATE users SET last_login=?, username=?, password=?, status=? WHERE email=?", 
                      (now, username, password, status, email))
        else:
            # Insert new user
            c.execute("INSERT INTO users (email, username, password, status, last_login) VALUES (?, ?, ?, ?, ?)", 
                      (email, username, password, status, now))
                      
        conn.commit()
        conn.close()
        return jsonify({"message": "User synced to backend successfully"})
    except Exception as e:
        print(f"Database Error: {e}")
        return jsonify({"error": "Database error"}), 500

@app.route('/api/users', methods=['GET'])
def get_users():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT id, email, username, password, status FROM users")
        users = [{'id': row[0], 'email': row[1], 'username': row[2], 'password': row[3], 'status': row[4]} for row in c.fetchall()]
        conn.close()
        return jsonify({"users": users})
    except Exception as e:
        print(f"Database Error: {e}")
        return jsonify({"error": "Database error"}), 500


@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('q', '')
    if not query:
        return jsonify({"error": "No query provided"}), 400

    try:
        # Use ytmusicapi for accurate YouTube Music IDs instead of generic yt-dlp search
        search_results = ytmusic.search(query, filter="songs", limit=15)
        
        results = []
        for track in search_results:
            if not track.get('videoId'):
                continue
                
            artists = [a['name'] for a in track.get('artists', [])]
            artist_name = ", ".join(artists) if artists else 'Unknown Artist'
            
            thumbnails = track.get('thumbnails', [])
            cover = thumbnails[-1]['url'] if thumbnails else f"https://i.ytimg.com/vi/{track['videoId']}/hqdefault.jpg"
            
            # Extract duration, ytmusicapi provides duration_seconds or duration (string)
            duration_sec = track.get('duration_seconds')
            if duration_sec is None:
                duration_str = track.get('duration', '3:00')
                parts = duration_str.split(':')
                if len(parts) == 2:
                    duration_sec = int(parts[0]) * 60 + int(parts[1])
                elif len(parts) == 3:
                    duration_sec = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                else:
                    duration_sec = 180
                    
            results.append({
                'id': track['videoId'],
                'title': track.get('title', 'Unknown Title'),
                'artist': artist_name,
                'duration': duration_sec,
                'cover': cover
            })
            
        return jsonify({"results": results})
    except Exception as e:
        print(f"Search Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/related', methods=['GET'])
def get_related():
    video_id = request.args.get('video_id', '')
    if not video_id:
        return jsonify({"error": "No video_id provided"}), 400
    
    try:
        # Get the watch playlist (radio) for this video
        playlist = ytmusic.get_watch_playlist(videoId=video_id, limit=15)
        
        results = []
        if 'tracks' in playlist:
            for track in playlist['tracks']:
                if not track.get('videoId'):
                    continue
                    
                # Format artist string
                artists = [a['name'] for a in track.get('artists', [])]
                artist_name = ", ".join(artists) if artists else 'Unknown Artist'
                
                # Get best thumbnail
                thumbnails = track.get('thumbnails', [])
                cover = thumbnails[-1]['url'] if thumbnails else f"https://i.ytimg.com/vi/{track['videoId']}/hqdefault.jpg"
                
                # Convert duration like "3:45" to seconds (approximate if needed, though frontend handles strings or numbers if we just pass a number, wait, the search endpoint passes seconds: `duration: entry.get('duration', 180)`).
                # Actually ytmusicapi returns length as string "3:45" sometimes. 
                # Let's try to convert it.
                lengthStr = track.get('length', '3:00')
                duration_sec = 180
                if lengthStr and ':' in lengthStr:
                    parts = lengthStr.split(':')
                    if len(parts) == 2:
                        duration_sec = int(parts[0]) * 60 + int(parts[1])
                    elif len(parts) == 3:
                        duration_sec = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                
                results.append({
                    'id': track['videoId'],
                    'title': track.get('title', 'Unknown Title'),
                    'artist': artist_name,
                    'duration': duration_sec,
                    'cover': cover
                })
                
        return jsonify({"results": results})
    except Exception as e:
        print(f"Related Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/download/<video_id>', methods=['GET'])
def download(video_id):
    # Return direct URL for the frontend to handle download directly
    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio/best',
        'quiet': True,
        'no_warnings': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            url = info.get('url')
            if not url:
                return jsonify({"error": "No streaming URL found"}), 404
            
            return jsonify({"url": url, "title": info.get('title', 'song')})
    except Exception as e:
        print(f"Download Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/stream/<video_id>', methods=['GET'])
def stream(video_id):
    # Proxy the stream in chunks to bypass Vercel's 10s and 4.5MB limits
    # while also preventing YouTube's 403 Forbidden IP mismatch
    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio/best',
        'quiet': True,
        'no_warnings': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            url = info.get('url')
            if not url:
                return jsonify({"error": "No streaming URL found"}), 404
                
            yt_headers = info.get('http_headers', {})
            
            # Get total file size to properly handle chunking
            head_req = requests.head(url, headers=yt_headers)
            total_size = int(head_req.headers.get('Content-Length', 0))
            
            # Parse requested Range
            range_header = request.headers.get('Range', 'bytes=0-')
            byte_range = range_header.replace('bytes=', '').split('-')
            start = int(byte_range[0]) if byte_range[0] else 0
            
            # Force max chunk size of 3MB (safely under Vercel's 4.5MB limit)
            CHUNK_SIZE = 3 * 1024 * 1024
            end = int(byte_range[1]) if len(byte_range) > 1 and byte_range[1] else start + CHUNK_SIZE - 1
            
            if end - start + 1 > CHUNK_SIZE:
                end = start + CHUNK_SIZE - 1
                
            if total_size > 0 and end >= total_size:
                end = total_size - 1
                
            yt_headers['Range'] = f"bytes={start}-{end}"
            
            req = requests.get(url, headers=yt_headers, stream=True)
            
            excluded_headers = ['content-encoding', 'transfer-encoding', 'connection']
            resp_headers = {name: value for name, value in req.headers.items() if name.lower() not in excluded_headers}
            
            resp_headers['Content-Range'] = f"bytes {start}-{end}/{total_size if total_size > 0 else '*'}"
            resp_headers['Accept-Ranges'] = 'bytes'
            resp_headers['Content-Length'] = str(end - start + 1)
            
            return Response(req.iter_content(chunk_size=1024*1024), 
                            status=206, 
                            headers=resp_headers,
                            content_type=req.headers.get('Content-Type', 'audio/mp4'))
                            
    except Exception as e:
        print(f"Stream Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting Music+ Backend Server on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)
