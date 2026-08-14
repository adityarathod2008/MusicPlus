let songs = [];
const genres = ["All", "Electronic", "Hip-Hop", "Pop", "Lo-Fi", "Rock"];
const playlists = [];

const BACKEND_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') 
    ? 'http://127.0.0.1:5000' 
    : ''; // Use relative paths on Vercel so it hits the Vercel backend

async function loadTrendingSongs() {
    try {
        // Fetch trending/top tracks from our local Python backend
        const response = await fetch(`${BACKEND_URL}/search?q=top+hindi+hits`);
        const data = await response.json();

        if (data && data.results) {
            songs = data.results.map(formatYouTubeTrack);
            return songs;
        }
        throw new Error("Invalid API response");
    } catch (e) {
        console.error("Failed to fetch from backend API:", e);
        // Fallback to a few open source tracks if backend isn't running
        songs = [
            {
                id: "s1", title: "Backend Not Running", artist: "System", album: "Error",
                cover: "https://placehold.co/300x300/121212/1DB954?text=Music+",
                src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
                duration: "06:12", genre: "Electronic"
            }
        ];
        return songs;
    }
}

function formatYouTubeTrack(track) {
    return {
        id: track.id,
        title: track.title || 'Unknown Title',
        artist: track.artist || 'Unknown Artist',
        album: 'YouTube Music',
        cover: track.cover || 'https://placehold.co/300x300/121212/1DB954?text=Music+',
        src: `${BACKEND_URL}/stream/${track.id}`,
        duration: formatSeconds(track.duration || 180),
        genre: 'Music',
        color: '#1DB954',
        lyrics: []
    };
}

function formatSeconds(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

async function searchAudiusTracks(query) {
    try {
        // Use our local Python backend for search
        const response = await fetch(`${BACKEND_URL}/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data && data.results) {
            return data.results.map(formatYouTubeTrack);
        }
        return [];
    } catch (e) {
        console.error("Failed to search backend:", e);
        return [];
    }
}
