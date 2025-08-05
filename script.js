document.addEventListener('DOMContentLoaded', () => {

    const state = {
        allTracks: [],
        filteredTracks: [],
        currentTrackIndex: -1,
        currentPlayableUrl: null, // To store the temporary download URL
        isPlaying: false,
        audio: new Audio(),
        lastVolume: 0.75,
        isMuted: false,
        isLooping: false,
        sortOrder: 'liked_on_desc'
    };

    const dom = {
        loadingOverlay: document.getElementById('loading-overlay'),
        appWrapper: document.getElementById('app-wrapper'),
        gridContainer: document.getElementById('track-grid-container'),
        searchInput: document.getElementById('search-input'),
        sortSelect: document.getElementById('sort-select'),
        shuffleBtn: document.getElementById('shuffle-btn'),
        player: document.getElementById('persistent-player'),
        playerArtwork: document.querySelector('.player-artwork'),
        playerTitle: document.querySelector('.player-title'),
        playerArtist: document.querySelector('.player-artist'),
        playPauseBtn: document.getElementById('play-pause-btn'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        repeatBtn: document.getElementById('repeat-btn'),
        downloadBtn: document.getElementById('download-btn'), // New download button
        progressFilled: document.querySelector('.progress-bar-filled'),
        progressContainer: document.querySelector('.progress-bar-container'),
        currentTimeEl: document.querySelector('.current-time'),
        durationEl: document.querySelector('.duration'),
        muteBtn: document.getElementById('mute-btn'),
        volumeSlider: document.getElementById('volume-slider'),
        detailsBtn: document.getElementById('details-btn'),
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
    
    function processRawData(rawData) {
        return rawData.map(item => {
            const track = item;
            const progressiveStream = track.media.transcodings.find(t => t.format.protocol === 'progressive' && t.format.mime_type === 'audio/mpeg');
            const streamUrl = progressiveStream ? progressiveStream.url : null;
            const artworkUrl = track.artwork_url ? track.artwork_url.replace('-large.jpg', '-t500x500.jpg') : 'https://i.imgur.com/ClMFeop.png';
            return {
                id: track.id, title: track.title, artist: track.user.username, artistUrl: track.user.permalink_url, artwork: artworkUrl, audioUrl: streamUrl, duration: track.duration || 0, plays: track.playback_count || 0, likes: track.likes_count || 0, comments: track.comment_count || 0, permalink: track.permalink_url, description: track.description, genre: track.genre || '', tags: track.tag_list || '', purchaseUrl: track.purchase_url, purchaseTitle: track.purchase_title, likedOn: track.liked_on, authorization: track.track_authorization
            };
        }).filter(track => track.audioUrl);
    }
    
    function renderTrackGrid() {
        dom.gridContainer.innerHTML = '';
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
                const trackIndex = state.filteredTracks.findIndex(t => t.id === track.id);
                if (trackIndex !== -1) playTrack(trackIndex);
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

    async function playTrack(trackIndexInFilteredList) {
        try {
            state.currentTrackIndex = trackIndexInFilteredList;
            state.currentPlayableUrl = null; // Reset previous download URL
            const track = state.filteredTracks[state.currentTrackIndex];
            if (!track) throw new Error(`FAILED to get track object`);
            updatePlayerUI(track);
            const apiUrl = track.audioUrl + `?client_id=TDpcHvOGD2S6kMZvWHkBliBlM7bqlcuf`;
            const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(apiUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Proxy returned a non-200 status: ${response.status}. Body: ${errorText}`);
            }
            const soundcloudData = await response.json();
            const playableUrl = soundcloudData.url;
            if (!playableUrl) throw new Error("API response via proxy did not contain a playable 'url'.");
            
            state.currentPlayableUrl = playableUrl; // Save the URL for downloading
            state.audio.src = playableUrl;
            await state.audio.play();
        } catch (error) {
            console.error("Fucking hell, the play process failed. Here's the error:", error);
        }
    }

    // --- NEW DOWNLOAD FUNCTION ---
    async function downloadCurrentTrack() {
        if (state.currentTrackIndex === -1 || !state.currentPlayableUrl) {
            alert("No track is available to download. Please play a track first.");
            return;
        }
    
        const track = state.filteredTracks[state.currentTrackIndex];
        const downloadBtnIcon = dom.downloadBtn.querySelector('.icon');
        downloadBtnIcon.textContent = '…'; // Show a loading state
        dom.downloadBtn.disabled = true;
    
        try {
            // Fetch the audio data as a binary blob
            const response = await fetch(state.currentPlayableUrl);
            if (!response.ok) throw new Error('Network response for download was not ok.');
            const blob = await response.blob();
    
            // Create a temporary link to trigger the download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            // Sanitize the filename to remove illegal characters
            const fileName = `${track.artist} - ${track.title}.mp3`.replace(/[<>:"/\\|?*]+/g, '_');
            a.download = fileName;
            
            document.body.appendChild(a);
            a.click();
    
            // Clean up the temporary URL and link
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
    
        } catch (err) {
            console.error("Download failed:", err);
            alert("Failed to download the track. See console for details.");
        } finally {
            // Restore the button to its normal state
            downloadBtnIcon.textContent = '⬇️';
            dom.downloadBtn.disabled = false;
        }
    }


    function togglePlayPause() {
        if (state.audio.paused) {
            if (!state.audio.src) {
                if (state.filteredTracks.length > 0) playTrack(0);
            } else { state.audio.play(); }
        } else { state.audio.pause(); }
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
    
    function handleSearchAndFilter() {
        const query = dom.searchInput.value.toLowerCase();
        state.filteredTracks = state.allTracks.filter(track => (track.title.toLowerCase().includes(query) || track.artist.toLowerCase().includes(query) || track.genre.toLowerCase().includes(query) || track.tags.toLowerCase().includes(query)));
        sortTracks();
        renderTrackGrid();
    }
    
    function sortTracks() {
        state.sortOrder = dom.sortSelect.value;
        const [key, dir] = state.sortOrder.split('_');
        state.filteredTracks.sort((a, b) => {
            let valA, valB;
            if (key === 'likedOn') {
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

    function shuffleTracks() {
        let array = state.filteredTracks;
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        dom.sortSelect.value = 'liked_on_desc';
        renderTrackGrid();
    }

    function setupEventListeners() {
        dom.playPauseBtn.addEventListener('click', togglePlayPause);
        dom.nextBtn.addEventListener('click', playNext);
        dom.prevBtn.addEventListener('click', playPrev);
        dom.downloadBtn.addEventListener('click', downloadCurrentTrack); // New download listener

        state.audio.addEventListener('play', () => { state.isPlaying = true; dom.playPauseBtn.innerHTML = `<span class="icon">⏸</span>`; });
        state.audio.addEventListener('pause', () => { state.isPlaying = false; dom.playPauseBtn.innerHTML = `<span class="icon">▶️</span>`; document.title = "NekoCloud"; });
        state.audio.addEventListener('ended', () => { if (!state.isLooping) playNext(); });
        state.audio.addEventListener('timeupdate', () => {
            if (!isNaN(state.audio.duration)) {
                const percent = (state.audio.currentTime / state.audio.duration) * 100;
                dom.progressFilled.style.width = `${percent}%`;
            }
            dom.currentTimeEl.textContent = formatTime(state.audio.currentTime);
        });
        
        dom.volumeSlider.addEventListener('input', e => {
            state.audio.muted = false;
            state.audio.volume = parseFloat(e.target.value);
        });
        dom.muteBtn.addEventListener('click', () => {
            state.audio.muted = !state.audio.muted;
            if (!state.audio.muted) {
                state.audio.volume = state.lastVolume > 0 ? state.lastVolume : 0.75;
            }
        });
        state.audio.addEventListener('volumechange', () => {
            state.isMuted = state.audio.muted;
            if (!state.isMuted) {
                state.lastVolume = state.audio.volume;
            }
            if (state.isMuted || state.audio.volume === 0) {
                dom.muteBtn.innerHTML = `<span class="icon">🔇</span>`;
                dom.volumeSlider.value = 0;
            } else {
                dom.muteBtn.innerHTML = `<span class="icon">🔊</span>`;
                dom.volumeSlider.value = state.audio.volume;
            }
        });
        dom.repeatBtn.addEventListener('click', () => {
            state.isLooping = !state.isLooping;
            state.audio.loop = state.isLooping;
            dom.repeatBtn.classList.toggle('active', state.isLooping);
        });

        dom.progressContainer.addEventListener('click', e => {
            if (!isNaN(state.audio.duration)) {
                const rect = dom.progressContainer.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                state.audio.currentTime = percent * state.audio.duration;
            }
        });

        dom.searchInput.addEventListener('input', handleSearchAndFilter);
        dom.sortSelect.addEventListener('change', () => { sortTracks(); renderTrackGrid(); });
        dom.shuffleBtn.addEventListener('click', shuffleTracks);
        
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
        dom.modalDescription.innerHTML = track.description ? track.description.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>') : '<i>No description available.</i>';
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
    
    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    async function init() {
        try {
            const response = await fetch('soundcloud_likes.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const rawData = await response.json();
            state.allTracks = processRawData(rawData);
            state.filteredTracks = [...state.allTracks];
            sortTracks();
            renderTrackGrid();
            setupEventListeners();
            dom.playPauseBtn.innerHTML = `<span class="icon">▶️</span>`;
            dom.muteBtn.innerHTML = `<span class="icon">🔊</span>`;
            dom.volumeSlider.value = state.lastVolume;
            state.audio.volume = state.lastVolume;
            dom.loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                dom.loadingOverlay.style.display = 'none';
                dom.appWrapper.style.display = 'block';
                requestAnimationFrame(() => dom.appWrapper.classList.add('visible'));
            }, 500);
        } catch (error) {
            console.error("Fucking hell, couldn't initialize the app:", error);
            dom.loadingOverlay.innerHTML = `<div class="loading-text">FATAL ERROR</div>`;
        }
    }

    init();
});
