const state = {
    allTracks: [],
    filteredTracks: [],
    currentTrackIndex: -1,
    isPlaying: false,
    // --- THIS IS THE CHANGE ---
    audio: Object.assign(new Audio(), { crossOrigin: 'anonymous' }),
    // --- END CHANGE ---
    lastVolume: 0.75,
    isMuted: false,
    sortOrder: 'liked_on_desc'
};


document.addEventListener('DOMContentLoaded', () => {

    const state = {
        allTracks: [],
        filteredTracks: [],
        currentTrackIndex: -1,
        isPlaying: false,
        audio: new Audio(),
        lastVolume: 0.75,
        isMuted: false,
        sortOrder: 'liked_on_desc'
    };

    // --- DOM ELEMENT REFERENCES ---
    const dom = {
        loadingOverlay: document.getElementById('loading-overlay'),
        appWrapper: document.getElementById('app-wrapper'),
        gridContainer: document.getElementById('track-grid-container'),
        searchInput: document.getElementById('search-input'),
        sortSelect: document.getElementById('sort-select'),
        // Player elements
        player: document.getElementById('persistent-player'),
        playerArtwork: document.querySelector('.player-artwork'),
        playerTitle: document.querySelector('.player-title'),
        playerArtist: document.querySelector('.player-artist'),
        playPauseBtn: document.getElementById('play-pause-btn'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        progressFilled: document.querySelector('.progress-bar-filled'),
        progressContainer: document.querySelector('.progress-bar-container'),
        currentTimeEl: document.querySelector('.current-time'),
        durationEl: document.querySelector('.duration'),
        muteBtn: document.getElementById('mute-btn'),
        volumeSlider: document.getElementById('volume-slider'),
        detailsBtn: document.getElementById('details-btn'),
        // Modal elements
        modal: document.getElementById('track-detail-modal'),
        modalCloseBtn: document.querySelector('.modal-close-btn'),
        modalArtwork: document.querySelector('.modal-artwork'),
        modalTitle: document.querySelector('.modal-title'),
        modalArtist: document.querySelector('.modal-artist'),
        modalPlays: document.getElementById('modal-plays'),
        modalLikes: document.getElementById('modal-likes'),
        modalComments: document.getElementById('modal-comments'),
        modalTags: document.querySelector('.modal-tags'),
        modalDescription: document.querySelector('.modal-description'),
        modalSoundCloudLink: document.getElementById('modal-soundcloud-link'),
        modalPurchaseLink: document.getElementById('modal-purchase-link'),
    };

// --- DATA PROCESSING ---
// --- REPLACE processRawData WITH THIS DEBUG VERSION ---
function processRawData(rawData) {
    console.log("--- Starting to process raw data ---");
    return rawData.map((item, index) => {
        const track = item;

        // --- DEBUG LOG ---
        if (index < 5) { // Log the first 5 items to check for the token
            console.log(`Item ${index}:`, track);
            console.log(`Item ${index} has track_authorization:`, track.track_authorization);
        }
        // --- END DEBUG LOG ---

        const progressiveStream = track.media.transcodings.find(
            t => t.format.protocol === 'progressive' && t.format.mime_type === 'audio/mpeg'
        );
        const streamUrl = progressiveStream ? progressiveStream.url : null;
        const artworkUrl = track.artwork_url ? track.artwork_url.replace('-large.jpg', '-t500x500.jpg') : 'https://i.imgur.com/ClMFeop.png';

        return {
            id: track.id,
            title: track.title,
            artist: track.user.username,
            artistUrl: track.user.permalink_url,
            artwork: artworkUrl,
            audioUrl: streamUrl,
            duration: track.duration || 0,
            plays: track.playback_count || 0,
            likes: track.likes_count || 0,
            comments: track.comment_count || 0,
            permalink: track.permalink_url,
            description: track.description,
            genre: track.genre || '',
            tags: track.tag_list || '',
            purchaseUrl: track.purchase_url,
            purchaseTitle: track.purchase_title,
            likedOn: track.liked_on,
            authorization: track.track_authorization // Saving the token here
        };
    }).filter(track => track.audioUrl);
}
    
    // --- RENDER FUNCTIONS ---
  // REPLACE your old renderTrackGrid function with this one
function renderTrackGrid() {
    dom.gridContainer.innerHTML = ''; // Clear previous results
    if (state.filteredTracks.length === 0) {
        dom.gridContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center;">No tracks found matching your criteria.</p>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    state.filteredTracks.forEach(track => {
        const card = document.createElement('div');
        card.className = 'track-card';
        card.dataset.id = track.id;
        card.innerHTML = `
            <img src="${track.artwork}" alt="${track.title} artwork" class="artwork" loading="lazy">
            <div class="info">
                <div class="title" title="${track.title}">${track.title}</div>
                <div class="artist" title="${track.artist}">${track.artist}</div>
                <div class="stats">
                    <span>▶️ ${track.plays.toLocaleString()}</span>
                    <span>❤️ ${track.likes.toLocaleString()}</span>
                </div>
            </div>
        `;
        card.addEventListener('click', () => {
            console.log(`--- CLICK DETECTED ---`);
            console.log(`Card clicked for track:`, track);

            const trackIndex = state.filteredTracks.findIndex(t => t.id === track.id);
            console.log(`Found track at index: ${trackIndex}`);

            if (trackIndex !== -1) {
                playTrack(trackIndex);
            } else {
                console.error("CRITICAL ERROR: Could not find the clicked track in the filtered list. This shouldn't happen.");
            }
        });
        fragment.appendChild(card);
    });
    dom.gridContainer.appendChild(fragment);
}



function updatePlayerUI(track) {
    dom.playerArtwork.src = track.artwork;
    dom.playerTitle.textContent = track.title;
    dom.playerArtist.textContent = track.artist;
    dom.durationEl.textContent = formatTime(track.duration / 1000);
    document.title = `${track.title} - ${track.artist}`;
    dom.player.classList.remove('hidden');
}




    // --- PLAYER LOGIC ---
// --- REPLACE playTrack WITH THIS FINAL, CORRECTLY ARCHITECTED VERSION ---
async function playTrack(trackIndexInFilteredList) {
    console.log(`[playTrack] Function called with index: ${trackIndexInFilteredList}`);
    
    try {
        state.currentTrackIndex = trackIndexInFilteredList;
        const track = state.filteredTracks[state.currentTrackIndex];
        
        if (!track) throw new Error(`FAILED to get track object`);
        
        console.log(`[playTrack] Preparing to play:`, track);
        updatePlayerUI(track);

        // --- THE CORRECT AUTHORIZATION METHOD FOR A PROXY ---
        // We are using the global client_id, which is less strict than the per-track token.
        const apiUrl = track.audioUrl + `?client_id=TDpcHvOGD2S6kMZvWHkBliBlM7bqlcuf`;

        // Using the proxy that gave us the clearest errors before.
        const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(apiUrl)}`;
        
        console.log(`[playTrack] Fetching stream URL via proxy with client_id: ${proxyUrl}`);

        // This is a "simple request" so it will NOT trigger a preflight OPTIONS call.
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Proxy returned a non-200 status: ${response.status}. Body: ${errorText}`);
        }

        const soundcloudData = await response.json();
        console.log("--- PROXY RESPONSE (PARSED) ---", soundcloudData);
        
        const playableUrl = soundcloudData.url;
        if (!playableUrl) {
            throw new Error("API response via proxy did not contain a playable 'url'.");
        }
        
        console.log(`[playTrack] SUCCESS! Got playable stream URL:`, playableUrl);

        state.audio.src = playableUrl;
        await state.audio.play();
        console.log("[playTrack] Playback initiated.");

    } catch (error) {
        console.error("Fucking hell, the final play process failed. Here's the error:", error);
    }
}
    function togglePlayPause() {
        if (state.audio.paused) {
            if (!state.audio.src) { // If no song is loaded, play the first one
                if (state.filteredTracks.length > 0) playTrack(0);
            } else {
                state.audio.play();
            }
        } else {
            state.audio.pause();
        }
    }

    function playNext() {
        if (state.filteredTracks.length === 0) return;
        state.currentTrackIndex = (state.currentTrackIndex + 1) % state.filteredTracks.length;
        playTrack(state.currentTrackIndex);
    }

    function playPrev() {
        if (state.filteredTracks.length === 0) return;
        state.currentTrackIndex = (state.currentTrackIndex - 1 + state.filteredTracks.length) % state.filteredTracks.length;
        playTrack(state.currentTrackIndex);
    }
    
    // --- EVENT HANDLERS ---
    function handleSearchAndFilter() {
        const query = dom.searchInput.value.toLowerCase();
        state.filteredTracks = state.allTracks.filter(track => {
            return (
                track.title.toLowerCase().includes(query) ||
                track.artist.toLowerCase().includes(query) ||
                track.genre.toLowerCase().includes(query) ||
                track.tags.toLowerCase().includes(query)
            );
        });
        sortTracks();
        renderTrackGrid();
    }
    
    function sortTracks() {
        state.sortOrder = dom.sortSelect.value;
        const [key, dir] = state.sortOrder.split('_');
        
        state.filteredTracks.sort((a, b) => {
            let valA, valB;
            if (key === 'likedOn') { // Assuming 'liked_on' is a string date
                 valA = new Date(a.likedOn);
                 valB = new Date(b.likedOn);
            } else {
                 valA = a[key];
                 valB = b[key];
            }
            
            if (valA < valB) return dir === 'asc' ? -1 : 1;
            if (valA > valB) return dir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    function setupEventListeners() {
        // Player controls
        dom.playPauseBtn.addEventListener('click', togglePlayPause);
        dom.nextBtn.addEventListener('click', playNext);
        dom.prevBtn.addEventListener('click', playPrev);

        // Audio events
        state.audio.addEventListener('play', () => { 
            state.isPlaying = true;
            dom.playPauseBtn.innerHTML = `<span class="icon">⏸</span>`;
        });
        state.audio.addEventListener('pause', () => {
            state.isPlaying = false;
            dom.playPauseBtn.innerHTML = `<span class="icon">▶️</span>`;
            document.title = "NekoCloud";
        });
        state.audio.addEventListener('ended', playNext);
        state.audio.addEventListener('timeupdate', () => {
            const percent = (state.audio.currentTime / state.audio.duration) * 100;
            dom.progressFilled.style.width = `${percent}%`;
            dom.currentTimeEl.textContent = formatTime(state.audio.currentTime);
        });
        
        // Volume controls
        dom.volumeSlider.addEventListener('input', e => {
            state.audio.volume = e.target.value;
            state.audio.muted = false;
        });
        dom.muteBtn.addEventListener('click', () => state.audio.muted = !state.audio.muted);
        state.audio.addEventListener('volumechange', () => {
            state.isMuted = state.audio.muted;
            dom.muteBtn.innerHTML = `<span class="icon">${state.isMuted || state.audio.volume === 0 ? '🔇' : '🔊'}</span>`;
            dom.volumeSlider.value = state.isMuted ? 0 : state.audio.volume;
        });

        // Progress bar seeking
        dom.progressContainer.addEventListener('click', e => {
            const rect = dom.progressContainer.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            state.audio.currentTime = percent * state.audio.duration;
        });

        // Search and sort
        dom.searchInput.addEventListener('input', handleSearchAndFilter);
        dom.sortSelect.addEventListener('change', () => {
            sortTracks();
            renderTrackGrid();
        });
        
        // Modal
        dom.detailsBtn.addEventListener('click', showDetailsModal);
        dom.modalCloseBtn.addEventListener('click', () => dom.modal.classList.add('hidden'));
        dom.modal.addEventListener('click', (e) => { if (e.target === dom.modal) dom.modal.classList.add('hidden'); });
    }

    function showDetailsModal() {
        if (state.currentTrackIndex === -1) return;
        const track = state.filteredTracks[state.currentTrackIndex];
        
        dom.modalArtwork.src = track.artwork;
        dom.modalTitle.textContent = track.title;
        dom.modalArtist.textContent = track.artist;
        dom.modalPlays.textContent = track.plays.toLocaleString();
        dom.modalLikes.textContent = track.likes.toLocaleString();
        dom.modalComments.textContent = track.comments.toLocaleString();
        dom.modalDescription.innerHTML = track.description ? track.description.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>') : '<i>No description available.</i>';
        dom.modalSoundCloudLink.href = track.permalink;
        
        dom.modalTags.innerHTML = track.tags.split(' ').map(tag => tag.trim() ? `<span class="tag">${tag.replace(/"/g, '')}</span>` : '').join('');

        if (track.purchaseUrl) {
            dom.modalPurchaseLink.href = track.purchaseUrl;
            dom.modalPurchaseLink.textContent = track.purchaseTitle || 'Download/Purchase';
            dom.modalPurchaseLink.classList.remove('hidden');
        } else {
            dom.modalPurchaseLink.classList.add('hidden');
        }

        dom.modal.classList.remove('hidden');
    }
    
    // --- UTILITY ---
    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // --- INITIALIZATION ---
// REPLACE YOUR ENTIRE init() FUNCTION WITH THIS ONE
async function init() {


    state.audio.crossOrigin = "anonymous"; 

    try {
        console.log("App initializing...");
        const response = await fetch('soundcloud_likes.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const rawData = await response.json();
        console.log("Fetched raw data:", rawData);

        // --- THIS IS THE NEW BULLETPROOF PART ---
        let trackList;
        if (Array.isArray(rawData)) {
            console.log("Data is a direct array.");
            trackList = rawData;
        } else if (rawData.collection && Array.isArray(rawData.collection)) {
            console.log("Data is an object with a 'collection' array. Using that.");
            trackList = rawData.collection;
        } else {
            throw new Error("JSON data is not in a recognized format. It's not an array and doesn't contain a 'collection' array.");
        }
        // --- END OF NEW PART ---
        
        state.allTracks = processRawData(trackList);
        console.log(`Processed ${state.allTracks.length} playable tracks.`);

        state.filteredTracks = [...state.allTracks];
        
        sortTracks();
        renderTrackGrid();
        console.log("Track grid rendered.");

        setupEventListeners();
        console.log("Event listeners set up.");
        
        // Initial state for buttons
        dom.playPauseBtn.innerHTML = `<span class="icon">▶️</span>`;
        dom.muteBtn.innerHTML = `<span class="icon">🔊</span>`;

        // Fade out loading screen and fade in the app
        dom.loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            dom.loadingOverlay.style.display = 'none';
            dom.appWrapper.style.display = 'block';
            requestAnimationFrame(() => dom.appWrapper.classList.add('visible'));
        }, 500);
        console.log("Initialization complete. App is visible.");

    } catch (error) {
        console.error("Fucking hell, couldn't initialize the app:", error);
        dom.loadingOverlay.innerHTML = `<div class="loading-text">FATAL ERROR</div>`;
    }
}
    init();
});