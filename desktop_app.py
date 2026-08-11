import webview
import threading
import sys
import os
import time

# --- PyInstaller Hidden Imports ---
# We must import backend dependencies here so PyInstaller bundles them!
import flask
import flask_cors
import yt_dlp
import requests
# ----------------------------------

def get_base_path():
    """Get absolute path to resource, works for dev and for PyInstaller"""
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.dirname(__file__)
    return base_path

base_path = get_base_path()

# Add backend directory to path so we can import the app
backend_path = os.path.join(base_path, 'backend')
sys.path.append(backend_path)

from app import app

def start_server():
    """Run the Flask app on port 5000"""
    # use_reloader=False is important so it doesn't spawn duplicate processes
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)

if __name__ == '__main__':
    # Start the backend server in a separate thread
    print("Starting backend server thread...")
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Give the backend a second to start
    time.sleep(1)

    # Get the absolute path to index.html
    html_file = os.path.join(base_path, 'index.html')
    # Formatting for file URL
    url = f'file:///{html_file.replace(os.sep, "/")}'
    
    print(f"Opening native window with URL: {url}")
    
    # Create the native window
    webview.create_window('Music+', url=url, width=1280, height=800, background_color='#121212')
    
    # Start the GUI event loop
    webview.start(private_mode=False)
