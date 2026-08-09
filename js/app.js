document.addEventListener('DOMContentLoaded', async () => {
    // Initialize components
    const audioPlayer = new AudioPlayer();
    const visualizer = new AudioVisualizer(audioPlayer.audio);
    const lyricsSync = new LyricsSync(audioPlayer.audio);
    
    // UI Elements
    const app = document.getElementById('app');
    const visualizerBtn = document.getElementById('visualizer-btn');
    const lyricsBtn = document.getElementById('lyrics-btn');
    const queueBtn = document.getElementById('queue-btn');
    const closeDrawerBtn = document.getElementById('close-drawer');
    const drawerTitle = document.getElementById('drawer-view-title');
    
    const vizDrawer = document.getElementById('drawer-visualizer');
    const lyricsDrawer = document.getElementById('lyrics-drawer');
    const queueDrawer = document.getElementById('queue-drawer');
    const nowPlayingDrawer = document.getElementById('now-playing-drawer');
    
    // View navigation
    const navLinks = document.querySelectorAll('.nav-links li');
    const views = document.querySelectorAll('.view-container');
    const adminNav = document.getElementById('admin-nav');
    
    // Search
    const searchInput = document.getElementById('search-input');
    const searchContainer = document.getElementById('search-container');
    const searchResultsContainer = document.getElementById('search-results-container');
    const searchResultsList = document.getElementById('search-results-list');
    let searchTimeout = null;
    let currentSearchResults = [];
    
    // Auth Elements
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userAvatar = document.getElementById('user-avatar');
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const authTitle = document.getElementById('auth-title');
    const authToggleLink = document.getElementById('auth-toggle-link');
    const authToggleText = document.getElementById('auth-toggle-text');
    const authError = document.getElementById('auth-error');
    const usernameGroup = document.getElementById('username-group');
    const emailInput = document.getElementById('auth-email');
    const usernameInput = document.getElementById('auth-username');
    const otpInput = document.getElementById('auth-otp');
    const otpGroup = document.getElementById('otp-group');
    const sendOtpBtn = document.getElementById('send-otp-btn');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    
    // State
    let isLoginMode = true;
    let currentUser = JSON.parse(localStorage.getItem('currentUser'));
    let usersDB = JSON.parse(localStorage.getItem('usersDB') || '[]');
    let likedSongs = currentUser ? (currentUser.likedSongs || []) : [];
    
    // Seed Admin Account if it doesn't exist, and force reset password
    const adminUser = usersDB.find(u => u.email === 'admin@musicplus.com');
    if (!adminUser) {
        usersDB.push({
            id: 'admin_1',
            email: 'admin@musicplus.com',
            username: 'Admin',
            password: 'admin123',
            status: 'approved',
            likedSongs: []
        });
        localStorage.setItem('usersDB', JSON.stringify(usersDB));
    } else {
        // Force reset password for locked out user
        adminUser.password = 'admin123';
        localStorage.setItem('usersDB', JSON.stringify(usersDB));
    }
    
    // Also reset if currently logged in
    if (currentUser && currentUser.email === 'admin@musicplus.com') {
        currentUser.password = 'admin123';
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
    
    const playerLikeBtn = document.getElementById('player-like-btn');
    const drawerLikeBtn = document.querySelector('.drawer-like');
    const uploadBtn = document.getElementById('upload-local');
    const fileInput = document.getElementById('file-upload');
    let currentActiveSong = null;
    
    let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];
    
    await initData();
    initUI();
    
    async function initData() {
        document.getElementById('greeting').textContent = "Fetching Trending Music...";
        await loadTrendingSongs();
        updateGreeting();
    }
    
    function updateGreeting() {
        const hour = new Date().getHours();
        let timeString = 'Good evening';
        if (hour < 12) timeString = 'Good morning';
        else if (hour < 18) timeString = 'Good afternoon';
        
        document.getElementById('greeting').textContent = currentUser ? `${timeString}, ${currentUser.username}` : timeString;
    }
    
    function initUI() {
        populateHome();
        populateGenres();
        updatePlaylists();
        renderSearchHistory();
        checkAuthState();
        
        // Listen to song changes from player
        audioPlayer.onSongChange((song) => {
            currentActiveSong = song;
            lyricsSync.loadLyrics(song.lyrics);
            updateLikeButtonsState();
            visualizer.init(); // Init audio context on first play
            
            // Add to Play History for Recommendations
            if (currentUser) {
                if (!currentUser.playHistory) currentUser.playHistory = [];
                // Only add if it's not the same as the last played to prevent spam
                if (currentUser.playHistory.length === 0 || currentUser.playHistory[currentUser.playHistory.length - 1].id !== song.id) {
                    currentUser.playHistory.push(song);
                    // Keep history capped at 50 to save space
                    if (currentUser.playHistory.length > 50) currentUser.playHistory.shift();
                    
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    
                    // Update in Users DB array
                    const dbIndex = usersDB.findIndex(u => u.id === currentUser.id);
                    if(dbIndex > -1) {
                        usersDB[dbIndex] = currentUser;
                        localStorage.setItem('usersDB', JSON.stringify(usersDB));
                    }
                }
            }
        });
        
        // Drawer toggles
        visualizerBtn.addEventListener('click', () => openDrawer('viz'));
        lyricsBtn.addEventListener('click', () => openDrawer('lyrics'));
        queueBtn.addEventListener('click', () => openDrawer('queue'));
        closeDrawerBtn.addEventListener('click', () => app.classList.remove('drawer-open'));
        
        // Download Button
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                if (currentActiveSong && currentActiveSong.id) {
                    const downloadUrl = `http://127.0.0.1:5000/download/${currentActiveSong.id}`;
                    window.open(downloadUrl, '_blank');
                } else if (currentActiveSong && currentActiveSong.src) {
                    // For local uploads
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = currentActiveSong.src;
                    a.download = currentActiveSong.title + '.mp3';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            });
        }
        
        // Create Playlist
        const createPlaylistBtn = document.getElementById('create-playlist');
        if (createPlaylistBtn) {
            createPlaylistBtn.addEventListener('click', () => {
                const name = prompt("Enter a name for your new playlist:");
                if (name && name.trim()) {
                    playlists.push(name.trim());
                    updatePlaylists();
                }
            });
        }
        
        // Navigation
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                navLinks.forEach(l => l.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');
                
                const viewId = target.getAttribute('data-view');
                switchView(viewId);
                
                if (viewId === 'users-admin') {
                    renderUsersTable();
                }
            });
        });
        
        // Live Search Logic
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(searchTimeout);
            
            if (!query) {
                searchResultsContainer.style.display = 'none';
                document.getElementById('search-history-container').style.display = 'block';
                return;
            }
            
            document.getElementById('search-history-container').style.display = 'none';
            searchResultsContainer.style.display = 'block';
            searchResultsList.innerHTML = '<p>Searching live catalog...</p>';
            
            searchTimeout = setTimeout(() => handleLiveSearch(query), 500);
        });
        
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) {
                    saveSearchHistory(query);
                }
            }
        });
        
        // Like buttons
        playerLikeBtn.addEventListener('click', toggleLike);
        drawerLikeBtn.addEventListener('click', toggleLike);
        
        document.getElementById('liked-songs').addEventListener('click', () => {
            switchView('library');
        });
        
        // Upload logic
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileUpload);
        
        // Auth Logic
        logoutBtn.addEventListener('click', handleLogout);
        
        authToggleLink.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;
            authTitle.textContent = isLoginMode ? "Log in to Music+" : "Sign up for Music+";
            authToggleText.textContent = isLoginMode ? "Don't have an account?" : "Already have an account?";
            authToggleLink.textContent = isLoginMode ? "Sign up" : "Log in";
            usernameGroup.style.display = isLoginMode ? 'none' : 'flex';
            usernameInput.required = !isLoginMode;
            authError.style.display = 'none';
            otpGroup.style.display = 'none';
            sendOtpBtn.disabled = false;
            sendOtpBtn.textContent = 'Send OTP';
        });
        
        sendOtpBtn.addEventListener('click', async () => {
            const email = emailInput.value;
            if (!email) {
                authError.textContent = "Please enter your email first.";
                authError.style.display = 'block';
                return;
            }
            authError.style.display = 'none';
            sendOtpBtn.disabled = true;
            sendOtpBtn.textContent = 'Sending...';
            
            try {
                const response = await fetch('http://127.0.0.1:5000/api/auth/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                if (response.ok) {
                    otpGroup.style.display = 'block';
                    otpInput.required = true;
                    sendOtpBtn.textContent = 'OTP Sent';
                    authError.style.color = '#1DB954';
                    authError.textContent = "OTP sent! Check the backend console.";
                    authError.style.display = 'block';
                } else {
                    throw new Error(data.error);
                }
            } catch (err) {
                authError.style.color = 'var(--error)';
                authError.textContent = err.message || "Failed to send OTP.";
                authError.style.display = 'block';
                sendOtpBtn.disabled = false;
                sendOtpBtn.textContent = 'Send OTP';
            }
        });
        
        authForm.addEventListener('submit', handleAuthSubmit);
        
        // Settings Modal Logic
        const settingsModal = document.getElementById('user-settings-modal');
        userAvatar.addEventListener('click', () => {
            if (currentUser) {
                document.getElementById('settings-username').value = currentUser.username;
                document.getElementById('settings-password').value = '';
                document.getElementById('settings-message').style.display = 'none';
                settingsModal.style.display = 'flex';
            }
        });
        
        document.getElementById('close-settings').addEventListener('click', () => {
            settingsModal.style.display = 'none';
        });
        
        document.getElementById('settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const newUsername = document.getElementById('settings-username').value.trim();
            const oldPassword = document.getElementById('settings-old-password').value;
            const newPassword = document.getElementById('settings-password').value;
            const messageEl = document.getElementById('settings-message');
            
            // Password verification if they want to change password
            if (newPassword) {
                if (oldPassword !== currentUser.password) {
                    messageEl.textContent = 'Incorrect old password!';
                    messageEl.style.color = 'var(--error)';
                    messageEl.style.display = 'block';
                    return;
                }
            }
            
            if (newUsername) {
                currentUser.username = newUsername;
                if (newPassword) currentUser.password = newPassword;
                
                // Update in DB
                const dbIndex = usersDB.findIndex(u => u.id === currentUser.id);
                if (dbIndex > -1) {
                    usersDB[dbIndex] = currentUser;
                    localStorage.setItem('usersDB', JSON.stringify(usersDB));
                }
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                
                messageEl.textContent = 'Profile updated successfully!';
                messageEl.style.color = '#1DB954';
                messageEl.style.display = 'block';
                updateGreeting();
                userAvatar.setAttribute('title', currentUser.username);
                
                setTimeout(() => { settingsModal.style.display = 'none'; }, 1500);
            }
        });
    }
    
    // AUTHENTICATION LOGIC
    function checkAuthState() {
        if (!currentUser) {
            // Forced Login State
            authModal.style.display = 'flex';
            document.getElementById('main-content').style.filter = 'blur(10px)';
            loginBtn.style.display = 'block';
            userAvatar.style.display = 'none';
            logoutBtn.style.display = 'none';
            adminNav.style.display = 'none';
        } else {
            // Logged In State
            authModal.style.display = 'none';
            document.getElementById('main-content').style.filter = 'none';
            loginBtn.style.display = 'none';
            userAvatar.style.display = 'flex';
            logoutBtn.style.display = 'block';
            userAvatar.setAttribute('title', currentUser.username);
            updateGreeting();
            
            if (currentUser.email === 'admin@musicplus.com') {
                adminNav.style.display = 'flex';
            } else {
                adminNav.style.display = 'none';
            }
        }
    }
    
    async function handleAuthSubmit(e) {
        e.preventDefault();
        const email = emailInput.value;
        const otp = otpInput.value;
        const user = usernameInput.value;
        
        // Ensure OTP has been sent and entered
        if (otpGroup.style.display === 'none') {
            authError.style.color = 'var(--error)';
            authError.textContent = "Please request an OTP first.";
            authError.style.display = 'block';
            return;
        }
        
        try {
            // Very OTP via Flask Backend
            const response = await fetch('http://127.0.0.1:5000/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp })
            });
            
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error);
            }
            
            // OTP is valid! Proceed with Login / Register
            if (isLoginMode) {
                const foundUser = usersDB.find(u => u.email === email);
                if (foundUser) {
                    if (foundUser.status === 'pending') {
                        authError.style.color = 'var(--error)';
                        authError.textContent = "Your account is pending Admin approval.";
                        authError.style.display = 'block';
                        return;
                    }
                    currentUser = foundUser;
                    likedSongs = currentUser.likedSongs || [];
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    
                    authForm.reset();
                    otpGroup.style.display = 'none';
                    sendOtpBtn.disabled = false;
                    sendOtpBtn.textContent = 'Send OTP';
                    authError.style.display = 'none';
                    checkAuthState();
                } else {
                    authError.style.color = 'var(--error)';
                    authError.textContent = "Email not registered. Please sign up.";
                    authError.style.display = 'block';
                }
            } else {
                if (usersDB.find(u => u.email === email)) {
                    authError.style.color = 'var(--error)';
                    authError.textContent = "Email already registered.";
                    authError.style.display = 'block';
                    return;
                }
                const newUser = {
                    id: 'usr_' + Date.now(),
                    email: email,
                    username: user,
                    password: 'N/A', // Password is no longer used, OTP replaces it
                    status: 'pending',
                    likedSongs: []
                };
                usersDB.push(newUser);
                localStorage.setItem('usersDB', JSON.stringify(usersDB));
                
                authError.style.color = '#1DB954';
                authError.textContent = "Registration successful! Awaiting Admin approval.";
                authError.style.display = 'block';
                authForm.reset();
                otpGroup.style.display = 'none';
                sendOtpBtn.disabled = false;
                sendOtpBtn.textContent = 'Send OTP';
                
                // Switch back to login mode
                setTimeout(() => {
                    isLoginMode = true;
                    authTitle.textContent = "Log in to Music+";
                    authSubmitBtn.textContent = "Log In";
                    authToggleText.textContent = "Don't have an account?";
                    authToggleLink.textContent = "Sign up";
                    usernameGroup.style.display = 'none';
                    usernameInput.required = false;
                    authError.style.color = 'var(--error)';
                    authError.style.display = 'none';
                }, 3000);
            }
        } catch (err) {
            authError.style.color = 'var(--error)';
            authError.textContent = err.message || "Authentication failed.";
            authError.style.display = 'block';
        }
    }
    
    function handleLogout() {
        currentUser = null;
        likedSongs = [];
        localStorage.removeItem('currentUser');
        checkAuthState();
        switchView('home');
        // Reset active nav
        navLinks.forEach(l => l.classList.remove('active'));
        navLinks[0].classList.add('active');
        audioPlayer.audio.pause();
    }
    
    function renderUsersTable() {
        const tbody = document.getElementById('users-table-body');
        tbody.innerHTML = '';
        usersDB.forEach(u => {
            const tr = document.createElement('tr');
            
            let actionBtn = '';
            let statusColor = u.status === 'approved' ? 'var(--accent-color)' : '#f39c12';
            
            let deleteBtn = '';
            if (u.email !== 'admin@musicplus.com') {
                deleteBtn = `<button class="delete-btn" data-id="${u.id}" style="background: #e91429; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-left: 8px;">Delete</button>`;
            }
            
            if (u.status === 'pending') {
                actionBtn = `<button class="approve-btn" data-id="${u.id}" style="background: var(--accent-color); color: black; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">Approve</button>`;
            }
            
            tr.innerHTML = `
                <td>${u.id}</td>
                <td style="font-weight: 600;">${u.username}</td>
                <td>${u.email}</td>
                <td style="color: ${statusColor}; text-transform: capitalize;">${u.status}</td>
                <td>${actionBtn}${deleteBtn}</td>
            `;
            tbody.appendChild(tr);
        });
        
        // Add listeners to approve buttons
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.getAttribute('data-id');
                const userIndex = usersDB.findIndex(u => u.id === userId);
                if (userIndex > -1) {
                    usersDB[userIndex].status = 'approved';
                    localStorage.setItem('usersDB', JSON.stringify(usersDB));
                    renderUsersTable();
                }
            });
        });
        
        // Add listeners to delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.getAttribute('data-id');
                if(confirm("Are you sure you want to delete this user?")) {
                    usersDB = usersDB.filter(u => u.id !== userId);
                    localStorage.setItem('usersDB', JSON.stringify(usersDB));
                    renderUsersTable();
                }
            });
        });
    }
    
    // UI POPULATION LOGIC
    function populateHome() {
        const quickGrid = document.getElementById('quick-play-grid');
        const madeForYou = document.getElementById('made-for-you');
        const recentlyPlayed = document.getElementById('recently-played');
        
        quickGrid.innerHTML = '';
        madeForYou.innerHTML = '';
        recentlyPlayed.innerHTML = '';
        
        // Quick Play (first 6 songs)
        songs.slice(0, 6).forEach((song, i) => {
            const card = document.createElement('div');
            card.className = 'quick-card';
            card.innerHTML = `
                <img src="${song.cover}" alt="cover">
                <h4>${song.title}</h4>
                <button class="quick-play-btn"><i class="fas fa-play"></i></button>
            `;
            card.addEventListener('click', () => { audioPlayer.queue = songs; audioPlayer.playSong(song, i); });
            quickGrid.appendChild(card);
        });
        
        // Made For You
        songs.slice(6, 12).forEach((song, i) => {
            const card = createMusicCard(song, i + 6, songs);
            madeForYou.appendChild(card);
        });
        
        // Recently Played
        songs.slice(12, 18).forEach((song, i) => {
            const card = createMusicCard(song, i + 12, songs);
            recentlyPlayed.appendChild(card);
        });
    }
    
    function createMusicCard(song, index, queueArray) {
        const card = document.createElement('div');
        card.className = 'music-card';
        card.innerHTML = `
            <div class="card-img-container">
                <img src="${song.cover}" alt="cover" loading="lazy">
                <button class="card-play-btn"><i class="fas fa-play"></i></button>
            </div>
            <h4>${song.title}</h4>
            <p>${song.artist}</p>
        `;
        card.addEventListener('click', () => { audioPlayer.queue = queueArray; audioPlayer.playSong(song, index); });
        return card;
    }
    
    function populateGenres() {
        const grid = document.getElementById('genre-grid');
        if (!grid) return;
        grid.innerHTML = '';
        
        // Let's add some popular search terms since genres are limited
        const searchTerms = ["Electronic", "Hip-Hop", "Pop", "Lo-Fi", "Rock", "Bollywood", "Punjabi", "Workout", "Chill", "Romantic", "Party", "Acoustic"];
        
        searchTerms.forEach(term => {
            const card = document.createElement('div');
            card.className = 'music-card';
            card.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 25%)`;
            card.style.height = '120px';
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.style.justifyContent = 'center';
            card.style.overflow = 'hidden';
            
            card.innerHTML = `<h3 style="font-size: 20px; font-weight: 700; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${term}</h3>`;
            
            card.addEventListener('click', () => {
                const searchInput = document.getElementById('search-input');
                searchInput.value = term;
                searchInput.dispatchEvent(new Event('input'));
                
                // Trigger the enter keydown event to save it to history
                searchInput.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
            });
            
            grid.appendChild(card);
        });
    }
    
    function openDrawer(type) {
        app.classList.add('drawer-open');
        
        // Hide all
        lyricsDrawer.style.display = 'none';
        queueDrawer.style.display = 'none';
        nowPlayingDrawer.style.display = 'none';
        
        visualizerBtn.classList.remove('active');
        lyricsBtn.classList.remove('active');
        queueBtn.classList.remove('active');
        
        if (type === 'viz') {
            nowPlayingDrawer.style.display = 'block';
            vizDrawer.style.display = 'block';
            drawerTitle.textContent = 'Now Playing';
            visualizerBtn.classList.add('active');
            visualizer.init(); 
        } else if (type === 'lyrics') {
            nowPlayingDrawer.style.display = 'block';
            vizDrawer.style.display = 'none';
            lyricsDrawer.style.display = 'block';
            drawerTitle.textContent = 'Lyrics';
            lyricsBtn.classList.add('active');
        } else if (type === 'queue') {
            queueDrawer.style.display = 'block';
            drawerTitle.textContent = 'Queue';
            queueBtn.classList.add('active');
            renderQueue();
        }
    }
    
    function renderQueue() {
        const qList = document.getElementById('queue-list');
        qList.innerHTML = '';
        
        let draggedIndex = null;
        
        audioPlayer.queue.forEach((song, i) => {
            const item = document.createElement('div');
            item.className = 'queue-item';
            item.draggable = true;
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '12px';
            item.style.padding = '8px';
            item.style.borderRadius = '4px';
            
            const isPlaying = (i === audioPlayer.currentSongIndex);
            if (isPlaying) item.style.color = 'var(--accent-color)';
            
            item.innerHTML = `
                <i class="fas fa-grip-vertical queue-item-drag-handle"></i>
                <img src="${song.cover}" style="width: 40px; height: 40px; border-radius: 4px; pointer-events: none; flex-shrink: 0;">
                <div style="flex-grow: 1; pointer-events: none; overflow: hidden; min-width: 0;">
                    <div style="font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.title}</div>
                    <div style="font-size: 12px; color: var(--text-subdued); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.artist}</div>
                </div>
            `;
            
            // Delete button (don't allow deleting the currently playing song to avoid logic bugs)
            if (!isPlaying) {
                const delBtn = document.createElement('button');
                delBtn.innerHTML = '<i class="fas fa-times"></i>';
                delBtn.style.background = 'none';
                delBtn.style.border = 'none';
                delBtn.style.color = 'var(--text-subdued)';
                delBtn.style.cursor = 'pointer';
                delBtn.style.padding = '4px';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    audioPlayer.queue.splice(i, 1);
                    if (audioPlayer.currentSongIndex > i) {
                        audioPlayer.currentSongIndex--;
                    }
                    audioPlayer.saveSession();
                    renderQueue();
                };
                item.appendChild(delBtn);
            }
            
            // Drag Events
            item.addEventListener('dragstart', (e) => {
                draggedIndex = i;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });
            
            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });
            
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                if (draggedIndex === null || draggedIndex === i) return;
                
                // Reorder array
                const draggedSong = audioPlayer.queue.splice(draggedIndex, 1)[0];
                audioPlayer.queue.splice(i, 0, draggedSong);
                
                // Update currentSongIndex if it was affected
                if (audioPlayer.currentSongIndex === draggedIndex) {
                    audioPlayer.currentSongIndex = i;
                } else if (draggedIndex < audioPlayer.currentSongIndex && i >= audioPlayer.currentSongIndex) {
                    audioPlayer.currentSongIndex--;
                } else if (draggedIndex > audioPlayer.currentSongIndex && i <= audioPlayer.currentSongIndex) {
                    audioPlayer.currentSongIndex++;
                }
                
                audioPlayer.saveSession();
                renderQueue();
            });
            
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedIndex = null;
            });
            
            // Play song on double click or when clicking the text area
            item.addEventListener('dblclick', () => audioPlayer.playSong(song, i));
            
            qList.appendChild(item);
        });
    }
    
    function switchView(viewId) {
        views.forEach(v => v.classList.remove('active-view'));
        
        if (viewId === 'search') {
            document.getElementById('search-view').classList.add('active-view');
            searchContainer.style.display = 'block';
            searchInput.focus();
        } else {
            searchContainer.style.display = 'none';
            if (viewId === 'home') {
                document.getElementById('home-view').classList.add('active-view');
            } else if (viewId === 'library') {
                document.getElementById('library-view').classList.add('active-view');
                renderLikedSongs();
            } else if (viewId === 'users-admin') {
                document.getElementById('users-admin-view').classList.add('active-view');
            }
        }
    }
    
    async function handleLiveSearch(query) {
        currentSearchResults = await searchAudiusTracks(query);
        
        searchResultsList.innerHTML = '';
        if (currentSearchResults.length === 0) {
            searchResultsList.innerHTML = '<p>No results found</p>';
            return;
        }
        
        currentSearchResults.forEach((song, idx) => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '16px';
            item.style.padding = '8px';
            item.style.borderRadius = '4px';
            item.style.cursor = 'pointer';
            item.onmouseover = () => item.style.backgroundColor = 'var(--bg-color-elevated)';
            item.onmouseout = () => item.style.backgroundColor = 'transparent';
            
            item.innerHTML = `
                <img src="${song.cover}" style="width: 48px; height: 48px; border-radius: 4px;">
                <div style="flex-grow: 1;">
                    <div style="font-weight: 600;">${song.title}</div>
                    <div style="font-size: 14px; color: var(--text-subdued);">${song.artist}</div>
                </div>
            `;
            item.addEventListener('click', () => {
                // Play clicked song, then queue the global songs (excluding the clicked one) to provide variety
                audioPlayer.queue = [song, ...songs.filter(s => s.id !== song.id)];
                audioPlayer.playSong(song, 0);
                audioPlayer.saveSession();
            });
            searchResultsList.appendChild(item);
        });
    }
    
    function toggleLike() {
        if (!currentActiveSong) return;
        
        const index = likedSongs.findIndex(s => s.id === currentActiveSong.id);
        if (index > -1) {
            likedSongs.splice(index, 1);
        } else {
            likedSongs.push(currentActiveSong);
        }
        
        // Save to current user
        currentUser.likedSongs = likedSongs;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Save back to Users DB array
        const dbIndex = usersDB.findIndex(u => u.id === currentUser.id);
        if(dbIndex > -1) {
            usersDB[dbIndex] = currentUser;
            localStorage.setItem('usersDB', JSON.stringify(usersDB));
        }
        
        updateLikeButtonsState();
        
        // Refresh library view if active
        if (document.getElementById('library-view').classList.contains('active-view')) {
            renderLikedSongs();
        }
    }
    
    function updateLikeButtonsState() {
        if (!currentActiveSong || !currentUser) {
            playerLikeBtn.classList.remove('liked');
            playerLikeBtn.innerHTML = '<i class="far fa-heart"></i>';
            drawerLikeBtn.classList.remove('liked');
            drawerLikeBtn.innerHTML = '<i class="far fa-heart"></i>';
            return;
        }
        
        const isLiked = likedSongs.some(s => s.id === currentActiveSong.id);
        
        if (isLiked) {
            playerLikeBtn.classList.add('liked');
            playerLikeBtn.innerHTML = '<i class="fas fa-heart"></i>';
            drawerLikeBtn.classList.add('liked');
            drawerLikeBtn.innerHTML = '<i class="fas fa-heart"></i>';
        } else {
            playerLikeBtn.classList.remove('liked');
            playerLikeBtn.innerHTML = '<i class="far fa-heart"></i>';
            drawerLikeBtn.classList.remove('liked');
            drawerLikeBtn.innerHTML = '<i class="far fa-heart"></i>';
        }
    }
    
    function renderLikedSongs() {
        const list = document.getElementById('liked-songs-list');
        list.innerHTML = '';
        
        if (likedSongs.length === 0) {
            list.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-subdued);">No liked songs yet.</div>';
            return;
        }
        
        likedSongs.forEach((song, i) => {
            const item = document.createElement('div');
            item.style.display = 'grid';
            item.style.gridTemplateColumns = '40px 1fr 1fr 60px';
            item.style.alignItems = 'center';
            item.style.padding = '8px 16px';
            item.style.borderRadius = '4px';
            item.style.cursor = 'pointer';
            item.style.marginBottom = '4px';
            item.onmouseover = () => item.style.backgroundColor = 'var(--bg-color-elevated)';
            item.onmouseout = () => item.style.backgroundColor = 'transparent';
            
            item.innerHTML = `
                <div>${i + 1}</div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${song.cover}" style="width: 40px; height: 40px; border-radius: 4px;">
                    <div>
                        <div style="font-weight: 600; color: white;">${song.title}</div>
                        <div style="font-size: 14px; color: var(--text-subdued);">${song.artist}</div>
                    </div>
                </div>
                <div style="color: var(--text-subdued); font-size: 14px;">${song.album}</div>
                <div style="color: var(--text-subdued); font-size: 14px;">${song.duration}</div>
            `;
            
            item.addEventListener('click', () => {
                audioPlayer.queue = likedSongs;
                audioPlayer.playSong(song, i);
            });
            list.appendChild(item);
        });
    }
    
    function updatePlaylists() {
        const ul = document.getElementById('user-playlists');
        ul.innerHTML = '';
        playlists.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p;
            ul.appendChild(li);
        });
    }
    
    function handleFileUpload(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        Array.from(files).forEach((file, index) => {
            const objectUrl = URL.createObjectURL(file);
            const customSong = {
                id: 'custom-' + Date.now() + index,
                title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
                artist: 'Local Artist',
                album: 'Local Uploads',
                cover: 'https://via.placeholder.com/300?text=Local+File',
                src: objectUrl,
                duration: 'Unknown',
                genre: 'Local',
                color: '#333333',
                lyrics: []
            };
            
            songs.unshift(customSong); // Add to beginning
            audioPlayer.queue = songs;
            
            // Auto play first uploaded
            if (index === 0) {
                audioPlayer.playSong(customSong, 0);
            }
        });
        
        // Refresh home if active
        if (document.getElementById('home-view').classList.contains('active-view')) {
            populateHome();
        }
    }
    
    // Fullscreen toggle logic
    const fsBtn = document.getElementById('fullscreen-btn');
    const exitFsBtn = document.getElementById('exit-fullscreen');
    const fsPlayer = document.getElementById('fullscreen-player');
    const fsCover = document.getElementById('fs-cover');
    const fsTitle = document.getElementById('fs-title');
    const fsArtist = document.getElementById('fs-artist');
    
    fsBtn.addEventListener('click', () => {
        fsPlayer.style.display = 'flex';
        fsPlayer.style.position = 'fixed';
        fsPlayer.style.top = '0';
        fsPlayer.style.left = '0';
        fsPlayer.style.width = '100vw';
        fsPlayer.style.height = '100vh';
        fsPlayer.style.zIndex = '9999';
        fsPlayer.style.backgroundColor = 'black';
        
        if (currentActiveSong) {
            fsCover.src = currentActiveSong.cover;
            fsTitle.textContent = currentActiveSong.title;
            fsArtist.textContent = currentActiveSong.artist;
            // set blurred bg
            document.querySelector('.fs-bg-blur').style.backgroundImage = `url(${currentActiveSong.cover})`;
            document.querySelector('.fs-bg-blur').style.position = 'absolute';
            document.querySelector('.fs-bg-blur').style.width = '100%';
            document.querySelector('.fs-bg-blur').style.height = '100%';
            document.querySelector('.fs-bg-blur').style.filter = 'blur(50px) brightness(0.5)';
            document.querySelector('.fs-bg-blur').style.zIndex = '-1';
        }
    });
    
    exitFsBtn.addEventListener('click', () => {
        fsPlayer.style.display = 'none';
    });
    
    // Add styles dynamically for fs elements
    Object.assign(fsPlayer.style, {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
    });
    
    exitFsBtn.style.position = 'absolute';
    exitFsBtn.style.top = '40px';
    exitFsBtn.style.left = '40px';
    exitFsBtn.style.background = 'none';
    exitFsBtn.style.border = 'none';
    exitFsBtn.style.color = 'white';
    exitFsBtn.style.fontSize = '32px';
    exitFsBtn.style.cursor = 'pointer';
    
    Object.assign(document.querySelector('.fs-content').style, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px'
    });
    
    fsCover.style.width = '400px';
    fsCover.style.height = '400px';
    fsCover.style.borderRadius = '12px';
    fsCover.style.boxShadow = '0 12px 48px rgba(0,0,0,0.5)';
    
    // SEARCH HISTORY LOGIC
    function saveSearchHistory(query) {
        // Remove if exists to move it to top
        searchHistory = searchHistory.filter(q => q.toLowerCase() !== query.toLowerCase());
        searchHistory.unshift(query);
        if (searchHistory.length > 10) searchHistory.pop();
        localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
        renderSearchHistory();
    }
    
    window.saveSearchHistory = saveSearchHistory; // Expose globally if needed
    
    function renderSearchHistory() {
        const historyContainer = document.getElementById('search-history-container');
        const historyList = document.getElementById('search-history-list');
        if (!historyContainer || !historyList) return;
        
        if (searchHistory.length === 0) {
            historyContainer.style.display = 'none';
            return;
        }
        
        // Show if search input is empty
        if (!document.getElementById('search-input').value.trim()) {
            historyContainer.style.display = 'block';
        }
        
        historyList.innerHTML = '';
        searchHistory.forEach((query, index) => {
            const card = document.createElement('div');
            card.className = 'music-card';
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.style.justifyContent = 'space-between';
            card.style.padding = '12px';
            
            const leftGroup = document.createElement('div');
            leftGroup.style.display = 'flex';
            leftGroup.style.alignItems = 'center';
            leftGroup.style.cursor = 'pointer';
            leftGroup.style.flexGrow = '1';
            
            const icon = document.createElement('i');
            icon.className = 'fas fa-history';
            icon.style.marginRight = '12px';
            icon.style.color = 'var(--text-subdued)';
            icon.style.fontSize = '20px';
            
            const text = document.createElement('h4');
            text.textContent = query;
            text.style.margin = '0';
            
            leftGroup.appendChild(icon);
            leftGroup.appendChild(text);
            
            leftGroup.addEventListener('click', () => {
                const searchInput = document.getElementById('search-input');
                searchInput.value = query;
                searchInput.dispatchEvent(new Event('input'));
                saveSearchHistory(query); // bump to top
            });
            
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.style.background = 'none';
            deleteBtn.style.border = 'none';
            deleteBtn.style.color = 'var(--text-subdued)';
            deleteBtn.style.fontSize = '16px';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.padding = '4px 8px';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent clicking the card
                searchHistory.splice(index, 1);
                localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
                renderSearchHistory();
            });
            
            card.appendChild(leftGroup);
            card.appendChild(deleteBtn);
            
            historyList.appendChild(card);
        });
    }
    window.renderSearchHistory = renderSearchHistory; // expose
});
