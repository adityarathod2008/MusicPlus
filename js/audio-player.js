class AudioPlayer {
    constructor() {
        this.audio = document.getElementById('main-audio');
        this.isPlaying = false;
        this.isMuted = false;
        this.currentSongIndex = 0;
        this.queue = [];
        this.shuffle = false;
        this.repeat = 'none'; // 'none', 'all', 'one'
        this.volume = 1;
        
        // DOM Elements
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.shuffleBtn = document.getElementById('shuffle-btn');
        this.repeatBtn = document.getElementById('repeat-btn');
        this.muteBtn = document.getElementById('mute-btn');
        
        this.progressBarBg = document.getElementById('progress-area');
        this.progressBarFill = document.getElementById('progress-bar');
        this.currentTimeEl = document.getElementById('current-time');
        this.totalTimeEl = document.getElementById('total-time');
        
        this.volumeBarBg = document.getElementById('volume-area');
        this.volumeBarFill = document.getElementById('volume-bar');
        
        this.trackCover = document.getElementById('track-cover');
        this.trackTitle = document.getElementById('track-title');
        this.trackArtist = document.getElementById('track-artist');
        this.dynamicBg = document.getElementById('dynamic-bg');
        
        this.drawerCover = document.getElementById('drawer-cover');
        this.drawerTitle = document.getElementById('drawer-title');
        this.drawerArtist = document.getElementById('drawer-artist');
        
        this.onSongChangeCallbacks = [];
        
        this.init();
    }

    init() {
        // Event Listeners
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.nextBtn.addEventListener('click', () => this.playNext());
        this.prevBtn.addEventListener('click', () => this.playPrev());
        this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        this.repeatBtn.addEventListener('click', () => this.toggleRepeat());
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        
        this.audio.addEventListener('timeupdate', () => {
            this.updateProgress();
            // Throttle saveSession to every 5 seconds to avoid excessive writes
            if (Math.floor(this.audio.currentTime) % 5 === 0) {
                this.saveSession();
            }
        });
        this.audio.addEventListener('ended', () => this.handleSongEnd());
        this.audio.addEventListener('loadedmetadata', () => {
            this.totalTimeEl.textContent = this.formatTime(this.audio.duration);
        });
        
        // Loading states
        this.audio.addEventListener('waiting', () => {
            this.playPauseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        });
        this.audio.addEventListener('playing', () => {
            this.isPlaying = true;
            this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        });

        this.progressBarBg.addEventListener('click', (e) => this.seek(e));
        this.volumeBarBg.addEventListener('click', (e) => this.setVolume(e));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            if (e.code === 'Space') { e.preventDefault(); this.togglePlay(); }
            if (e.code === 'ArrowRight') { this.audio.currentTime += 5; }
            if (e.code === 'ArrowLeft') { this.audio.currentTime -= 5; }
            if (e.code === 'ArrowUp') { this.audio.volume = Math.min(1, this.audio.volume + 0.1); this.updateVolumeUI(); }
            if (e.code === 'ArrowDown') { this.audio.volume = Math.max(0, this.audio.volume - 0.1); this.updateVolumeUI(); }
        });
        
        // Initialize Session or Default Queue
        this.loadSession();
    }
    
    saveSession() {
        if (!this.queue || this.queue.length === 0) return;
        const sessionData = {
            queue: this.queue,
            currentIndex: this.currentSongIndex,
            currentTime: this.audio.currentTime,
            timestamp: Date.now()
        };
        localStorage.setItem('musicplus_session', JSON.stringify(sessionData));
    }
    
    loadSession() {
        const savedSession = localStorage.getItem('musicplus_session');
        if (savedSession) {
            try {
                const session = JSON.parse(savedSession);
                if (session.queue && session.queue.length > 0) {
                    this.queue = session.queue;
                    this.currentSongIndex = session.currentIndex || 0;
                    this.loadSong(this.queue[this.currentSongIndex]);
                    
                    // Restore time once metadata is loaded
                    const timeToRestore = session.currentTime || 0;
                    const onMeta = () => {
                        this.audio.currentTime = timeToRestore;
                        this.audio.removeEventListener('loadedmetadata', onMeta);
                    };
                    this.audio.addEventListener('loadedmetadata', onMeta);
                    
                    // Render queue in UI if available
                    if (typeof renderQueue === 'function') {
                        renderQueue();
                    }
                    return;
                }
            } catch (e) {
                console.error("Failed to load session", e);
            }
        }
        
        // Fallback to default behavior if no session
        this.queue = [...songs];
        if(this.queue.length > 0) {
            this.loadSong(this.queue[0]);
        }
    }

    loadSong(song) {
        if(!song) return;
        this.audio.src = song.src;
        this.trackTitle.textContent = song.title;
        this.trackArtist.textContent = song.artist;
        this.trackCover.src = song.cover;
        
        this.drawerTitle.textContent = song.title;
        this.drawerArtist.textContent = song.artist;
        this.drawerCover.src = song.cover;
        
        if (song.color) {
            this.dynamicBg.style.background = `linear-gradient(to bottom, ${song.color}, var(--bg-color-base))`;
        }
        
        this.onSongChangeCallbacks.forEach(cb => cb(song));
    }

    playSong(song, index) {
        if (song) {
            this.currentSongIndex = index;
            this.loadSong(song);
            this.addToListeningHistory(song);
        }
        this.audio.play().then(() => {
            this.isPlaying = true;
            this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        }).catch(err => console.log('Autoplay prevented', err));
    }

    togglePlay() {
        if (this.queue.length === 0) return;
        if (this.isPlaying) {
            this.audio.pause();
            this.isPlaying = false;
            this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        } else {
            this.audio.play();
            this.isPlaying = true;
            this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        }
    }

    async playNext() {
        if (this.queue.length === 0) return;
        
        if (this.shuffle) {
            let randomIndex = this.currentSongIndex;
            while(randomIndex === this.currentSongIndex && this.queue.length > 1) {
                randomIndex = Math.floor(Math.random() * this.queue.length);
            }
            this.currentSongIndex = randomIndex;
            this.playSong(this.queue[this.currentSongIndex], this.currentSongIndex);
        } else {
            this.currentSongIndex++;
            // Check if we need to buffer more songs (if less than 10 songs remain)
            if (this.queue.length - this.currentSongIndex <= 10) {
                this.bufferUpcomingSongs();
            }
            
            if (this.currentSongIndex >= this.queue.length) {
                // If it still runs out despite buffering, just wait for buffer to finish
                this.playPauseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                await this.bufferUpcomingSongs();
            }
            
            this.playSong(this.queue[this.currentSongIndex], this.currentSongIndex);
            this.saveSession();
        }
    }
    
    addToListeningHistory(song) {
        try {
            let history = JSON.parse(localStorage.getItem('listeningHistory') || '[]');
            // Remove if already exists so we can push it to the top
            history = history.filter(s => s.id !== song.id);
            history.unshift(song);
            // Keep only last 50 songs
            if (history.length > 50) history.pop();
            localStorage.setItem('listeningHistory', JSON.stringify(history));
            
            // Dispatch event for UI to update "Made for you" if needed
            window.dispatchEvent(new CustomEvent('listeningHistoryUpdated'));
        } catch(e) {
            console.error("Failed to save history", e);
        }
    }

    async bufferUpcomingSongs() {
        if (this.isBufferingQueue) return;
        this.isBufferingQueue = true;
        
        try {
            const lastSong = this.queue[this.queue.length - 1] || this.queue[this.currentSongIndex];
            
            if (lastSong && lastSong.id) {
                // Fetch related songs using the YouTube algorithm
                const response = await fetch(`${BACKEND_URL}/related?video_id=${lastSong.id}`);
                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    const existingIds = new Set(this.queue.map(s => s.id));
                    const newSongs = data.results.filter(s => {
                        if (existingIds.has(s.id)) return false;
                        return true;
                    });
                    
                    // Add up to 10 new songs to the queue buffer
                    const songsToAdd = newSongs.slice(0, 10);
                    for (const song of songsToAdd) {
                        if (!song.src) {
                            song.src = `${BACKEND_URL}/stream/${song.id}`;
                        }
                        this.queue.push(song);
                    }
                }
            } else {
                // Fallback to trending search if no last song
                const response = await fetch(`${BACKEND_URL}/search?q=trending+music`);
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    for (const song of data.results.slice(0, 5)) {
                        if (!song.src) song.src = `${BACKEND_URL}/stream/${song.id}`;
                        this.queue.push(song);
                    }
                } else {
                    const randomFallback = songs[Math.floor(Math.random() * songs.length)];
                    this.queue.push(randomFallback);
                }
            }
        } catch (err) {
            console.error("Queue buffer failed", err);
        } finally {
            this.isBufferingQueue = false;
            if (typeof renderQueue === 'function') {
                renderQueue();
            }
            this.saveSession();
        }
    }

    playPrev() {
        if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            return;
        }
        this.currentSongIndex--;
        if (this.currentSongIndex < 0) {
            this.currentSongIndex = this.queue.length - 1;
        }
        this.playSong(this.queue[this.currentSongIndex], this.currentSongIndex);
    }

    handleSongEnd() {
        if (this.repeat === 'one') {
            this.audio.currentTime = 0;
            this.audio.play();
        } else if (this.repeat === 'all' && this.currentSongIndex === this.queue.length - 1) {
            this.currentSongIndex = 0;
            this.playSong(this.queue[0], 0);
        } else {
            this.playNext();
        }
    }

    toggleShuffle() {
        this.shuffle = !this.shuffle;
        this.shuffleBtn.classList.toggle('active', this.shuffle);
    }

    toggleRepeat() {
        if (this.repeat === 'none') {
            this.repeat = 'all';
            this.repeatBtn.classList.add('active');
            this.repeatBtn.innerHTML = '<i class="fas fa-redo"></i>';
        } else if (this.repeat === 'all') {
            this.repeat = 'one';
            this.repeatBtn.classList.add('active');
            this.repeatBtn.innerHTML = '<i class="fas fa-redo" style="position:relative"><span style="position:absolute; font-size:8px; top:50%; left:50%; transform:translate(-50%,-50%); font-weight:bold; background:#000; border-radius:50%; width:12px; height:12px; display:flex; align-items:center; justify-content:center;">1</span></i>';
        } else {
            this.repeat = 'none';
            this.repeatBtn.classList.remove('active');
            this.repeatBtn.innerHTML = '<i class="fas fa-redo"></i>';
        }
    }

    updateProgress() {
        const { currentTime, duration } = this.audio;
        if (!duration) return;
        
        const progressPercent = (currentTime / duration) * 100;
        this.progressBarFill.style.width = `${progressPercent}%`;
        this.currentTimeEl.textContent = this.formatTime(currentTime);
    }

    seek(e) {
        const width = this.progressBarBg.clientWidth;
        const clickX = e.offsetX;
        const duration = this.audio.duration;
        this.audio.currentTime = (clickX / width) * duration;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.audio.muted = this.isMuted;
        
        if (this.isMuted) {
            this.muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            this.volumeBarFill.style.width = '0%';
        } else {
            this.muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            this.updateVolumeUI();
        }
    }

    setVolume(e) {
        const width = this.volumeBarBg.clientWidth;
        const clickX = e.offsetX;
        this.volume = clickX / width;
        this.audio.volume = this.volume;
        this.isMuted = false;
        this.audio.muted = false;
        this.muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        this.updateVolumeUI();
    }

    updateVolumeUI() {
        this.volumeBarFill.style.width = `${this.audio.volume * 100}%`;
    }

    formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }

    onSongChange(cb) {
        this.onSongChangeCallbacks.push(cb);
    }
}
