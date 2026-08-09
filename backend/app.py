from flask import Flask, request, jsonify, redirect, Response
from flask_cors import CORS
import yt_dlp
import requests
import random
import time
import smtplib
from email.mime.text import MIMEText

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes so the frontend can hit this API

# Temporary store for OTPs: { email: { 'otp': '123456', 'expires': timestamp } }
otp_store = {}

@app.route('/api/auth/send-otp', methods=['POST'])
def send_otp():
    data = request.json
    email = data.get('email')
    if not email:
        return jsonify({"error": "Email is required"}), 400
        
    otp = str(random.randint(100000, 999999))
    otp_store[email] = {
        'otp': otp,
        'expires': time.time() + 300 # valid for 5 minutes
    }
    
    # --- CONFIGURATION: Load from config.py ---
    try:
        from config import SENDER_EMAIL, SENDER_PASSWORD
    except ImportError:
        SENDER_EMAIL = "your.email@gmail.com"
        SENDER_PASSWORD = "your-16-digit-app-password"
    
    msg = MIMEText(f"Welcome to Music+!\n\nYour 6-digit verification code is: {otp}\n\nThis code will expire in 5 minutes.")
    msg['Subject'] = 'Music+ Login Verification'
    msg['From'] = SENDER_EMAIL
    msg['To'] = email
    
    try:
        if SENDER_EMAIL == "your.email@gmail.com":
            # Fallback if the user hasn't set up their credentials yet
            print(f"\n==================================================")
            print(f"SIMULATED EMAIL TO: {email}")
            print(f"Your Music+ Login OTP is: {otp}")
            print(f"==================================================\n")
            return jsonify({"message": "App Password not configured! Simulated OTP sent to backend console."})
            
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            # Remove spaces from the app password just in case
            server.login(SENDER_EMAIL, SENDER_PASSWORD.replace(" ", ""))
            server.send_message(msg)
            
        return jsonify({"message": "OTP sent successfully to your email!"})
    except Exception as e:
        print(f"SMTP Error: {e}")
        return jsonify({"error": "Failed to send email. Check backend configuration."}), 500

@app.route('/api/auth/verify-otp', methods=['POST'])
def verify_otp():
    data = request.json
    email = data.get('email')
    user_otp = data.get('otp')
    
    if not email or not user_otp:
        return jsonify({"error": "Email and OTP required"}), 400
        
    if email not in otp_store:
        return jsonify({"error": "No OTP requested for this email"}), 400
        
    stored_data = otp_store[email]
    
    if time.time() > stored_data['expires']:
        del otp_store[email]
        return jsonify({"error": "OTP has expired"}), 400
        
    if stored_data['otp'] != user_otp:
        return jsonify({"error": "Invalid OTP"}), 400
        
    del otp_store[email] # Clear it after successful verification
    return jsonify({"message": "Verification successful"})

@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('q', '')
    if not query:
        return jsonify({"error": "No query provided"}), 400

    # yt-dlp options for FAST search (metadata only, no streaming URLs yet)
    ydl_opts = {
        'extract_flat': 'in_playlist',
        'default_search': 'ytsearch15', # get top 15 results
        'quiet': True,
        'no_warnings': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # We search "query audio" or "query song" to prioritize music
            search_query = f"{query} song"
            info = ydl.extract_info(search_query, download=False)
            
            results = []
            if 'entries' in info:
                for entry in info['entries']:
                    # Some entries might not have an id or title
                    if not entry.get('id') or not entry.get('title'):
                        continue
                        
                    results.append({
                        'id': entry['id'],
                        'title': entry.get('title', 'Unknown Title'),
                        'artist': entry.get('uploader', 'Unknown Artist'),
                        'duration': entry.get('duration', 180), # in seconds
                        'cover': f"https://i.ytimg.com/vi/{entry['id']}/hqdefault.jpg"
                    })
            return jsonify({"results": results})
    except Exception as e:
        print(f"Search Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/download/<video_id>', methods=['GET'])
def download(video_id):
    # This endpoint gets the streaming URL and forces a download
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
            req = requests.get(url, headers=yt_headers, stream=True)
            
            excluded_headers = ['content-encoding', 'transfer-encoding', 'connection']
            resp_headers = [(name, value) for (name, value) in req.headers.items()
                            if name.lower() not in excluded_headers]
            
            # Force download with a sanitized filename to prevent browser errors
            raw_title = info.get('title', 'song')
            safe_title = "".join([c for c in raw_title if c.isalpha() or c.isdigit() or c == ' ']).strip()
            if not safe_title:
                safe_title = "song"
            filename = f"{safe_title}.webm"
            resp_headers.append(('Content-Disposition', f'attachment; filename="{filename}"'))
            resp_headers.append(('Access-Control-Allow-Origin', '*'))
            
            return Response(req.iter_content(chunk_size=1024*1024), 
                            status=req.status_code, 
                            headers=resp_headers,
                            content_type=req.headers.get('Content-Type'))
                            
    except Exception as e:
        print(f"Download Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/stream/<video_id>', methods=['GET'])
def stream(video_id):
    # This endpoint gets the streaming URL and proxies it to fix CORS
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
                
            # Use yt-dlp's headers to prevent YouTube from blocking the request
            yt_headers = info.get('http_headers', {})
            
            # Forward the Range header so scrubbing/seeking works
            if 'Range' in request.headers:
                yt_headers['Range'] = request.headers['Range']
                
            req = requests.get(url, headers=yt_headers, stream=True)
            
            # Forward the response headers back to the browser
            excluded_headers = ['content-encoding', 'transfer-encoding', 'connection']
            resp_headers = [(name, value) for (name, value) in req.headers.items()
                            if name.lower() not in excluded_headers]
                            
            # Add CORS headers specifically for the stream so the visualizer works
            resp_headers.append(('Access-Control-Allow-Origin', '*'))
            
            return Response(req.iter_content(chunk_size=1024*1024), 
                            status=req.status_code, 
                            headers=resp_headers,
                            content_type=req.headers.get('Content-Type'))
                            
    except Exception as e:
        print(f"Stream Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting Music+ Backend Server on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)
