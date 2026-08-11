@echo off
echo Building Music+ Executable (this may take a few minutes)...
pyinstaller --noconfirm --onefile --windowed --icon "icon.ico" --add-data "backend;backend" --add-data "js;js" --add-data "index.html;." --add-data "style.css;."  "desktop_app.py"
echo Build complete! Check the 'dist' folder for MusicPlus.exe (it might be named desktop_app.exe).
pause
