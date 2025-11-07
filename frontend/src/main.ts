import './style.css';

window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const accessTokenFromUrl = urlParams.get("access_token");
  const errorFromUrl = urlParams.get("error");
  const userWrap = document.getElementById("user-info") as HTMLDivElement;
  const wrap = document.getElementById("results-wrap") as HTMLDivElement;
  const q = document.getElementById("q") as HTMLInputElement;
  const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;

  const savedToken = localStorage.getItem("spotify_access_token");
  let token: string | null = savedToken || accessTokenFromUrl || null;
  let tokenFetchedAt = 0;

  // Handle login errors
  if (errorFromUrl) {
    wrap.innerHTML = `<div class="error">Login failed. Please try again or check your Spotify account.</div>`;
    console.error("Spotify login error:", errorFromUrl);
  }

  // Save token from URL if present
  if (accessTokenFromUrl) {
    token = accessTokenFromUrl;
    localStorage.setItem("spotify_access_token", token);
    history.replaceState({}, "", "/");
  }

  // --- OAuth Popup ---
  loginBtn?.addEventListener("click", () => {
    const width = 450;
    const height = 730;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      "http://localhost:3001/login",
      "Spotify Login",
      `width=${width},height=${height},top=${top},left=${left}`
    );
  });

  // Listen for OAuth popup messages
  window.addEventListener("message", (event) => {
    const receivedToken = event.data?.access_token;
    const refreshToken = event.data?.refresh_token;

    if (receivedToken) {
      token = receivedToken;
      localStorage.setItem("spotify_access_token", receivedToken);
      if (refreshToken) localStorage.setItem("spotify_refresh_token", refreshToken);

      fetchUserProfile(receivedToken);
      fetchUserLibrary(receivedToken);
    }
  });

  // --- Fetch user profile ---
  async function fetchUserProfile(token: string) {
    try {
      const res = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 403) {
        console.warn("User not authorized. Token may belong to an invalid account.");
        showLoginError("Access denied. Please sign in with a valid Spotify account.");
        return null;
      }

      if (!res.ok) throw new Error(`Spotify API error (${res.status})`);

      const user = await res.json();
      renderUserProfile(user);
      return user;
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
      showLoginError("Could not load user profile.");
      return null;
    }
  }

  function renderUserProfile(user: any) {
    const imgUrl = user.images?.[0]?.url || "https://via.placeholder.com/40";
    const displayName = user.display_name || "Unknown User";

    if (!userWrap) return;

    userWrap.innerHTML = `
      <div class="user-dropdown">
        <img src="${imgUrl}" class="user-avatar" />
        <span class="user-name">${displayName}</span>
        <div class="user-menu hidden">
          <button id="logout-btn">Sign out</button>
        </div>
      </div>
    `;

    const dropdown = userWrap.querySelector(".user-dropdown");
    const menu = userWrap.querySelector(".user-menu");
    dropdown?.addEventListener("click", () => menu?.classList.toggle("hidden"));

    const logoutBtn = document.getElementById("logout-btn");
    logoutBtn?.addEventListener("click", () => {
      localStorage.removeItem("spotify_access_token");
      localStorage.removeItem("spotify_refresh_token");
      window.location.reload();
    });

    if (loginBtn) loginBtn.style.display = "none";
  }

  // --- Fetch user library ---
  async function fetchUserLibrary(token: string) {
    try {
      const res = await fetch("https://api.spotify.com/v1/me/tracks?limit=20", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Spotify API error (${res.status}): ${text}`);
      }

      const data = await res.json();
      if (!data.items) throw new Error("No saved tracks found or invalid account.");

      renderUserTracks(data.items);
    } catch (err) {
      console.error("Failed to fetch user library:", err);
      wrap.innerHTML = `<div class="error">Could not load your Spotify library. Try logging out and signing in again.</div>`;
    }
  }

  function renderUserTracks(tracks: any[]) {
    if (!wrap) return;
    wrap.innerHTML = "";

    if (tracks.length === 0) {
      wrap.textContent = "No saved tracks found.";
      return;
    }

    const ul = document.createElement("ul");
    tracks.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = `${t.track.name} — ${t.track.artists.map((a: any) => a.name).join(", ")}`;
      li.addEventListener("click", () => {
        window.location.href = `/detail.html#/track/${t.track.id}`;
      });
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
  }

  function showLoginError(message: string) {
    if (wrap) wrap.innerHTML = `<div class="error">${message}</div>`;
  }

  // --- Search functionality ---
  type SpotifyImage = { url: string; height?: number; width?: number };
  type ArtistShort = { name: string };
  type SpotifyItem = {
    id: string;
    name: string;
    type: "album" | "artist" | "track";
    artists?: ArtistShort[];
    images?: SpotifyImage[];
    album?: { images?: SpotifyImage[] };
  };

  let debounceTimer: number | undefined;

  q?.addEventListener("input", () => {
    const val = q.value.trim();
    if (debounceTimer) clearTimeout(debounceTimer);
    if (val.length < 2) {
      if (wrap) wrap.innerHTML = "";
      return;
    }
    debounceTimer = window.setTimeout(() => search(val), 250);
  });

  async function getTokenForSearch() {
    if (token) return token;

    const res = await fetch("http://localhost:3001/token");
    const data = await res.json();
    token = data.access_token;
    tokenFetchedAt = Date.now();
    return token;
  }

  async function search(term: string) {
    try {
      const t = await getTokenForSearch();
      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(term)}&type=album,artist,track&limit=8`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await resp.json();

      const items: SpotifyItem[] = [
        ...(data.tracks?.items ?? []),
        ...(data.albums?.items ?? []),
        ...(data.artists?.items ?? []),
      ];

      renderResults(items);
    } catch (err) {
      console.error(err);
      const searchResults = document.getElementById("search-results");
      if (searchResults) searchResults.innerHTML = `<div class="muted">Error fetching results</div>`;
    }
  }

  function renderResults(items: SpotifyItem[]) {
    const searchResults = document.getElementById("search-results");
    const input = document.getElementById("q") as HTMLInputElement;
    if (!searchResults || !input) return;

    searchResults.innerHTML = "";

    if (!items || items.length === 0) {
      searchResults.innerHTML = `<div class="muted">No results</div>`;
      searchResults.classList.add("show");
      return;
    }

    const ul = document.createElement("ul");
    let currentIndex = -1;

    items.forEach((it, index) => {
      const li = document.createElement("li");
      li.className = "result-item";

      const imgUrl =
        it.images?.[0]?.url || it.album?.images?.[0]?.url || "";

      const row = document.createElement("div");
      row.className = "row";

      if (imgUrl) {
        const img = document.createElement("img");
        img.src = imgUrl;
        img.className = "small-img";
        row.appendChild(img);
      }

      const text = document.createElement("div");
      const title = document.createElement("div");
      title.textContent = it.name;
      const meta = document.createElement("div");
      meta.className = "muted";

      if (it.type === "track" && it.artists) {
        meta.textContent = `Track — ${it.artists.map((a) => a.name).join(", ")}`;
      } else if (it.type === "album" && it.artists) {
        meta.textContent = `Album — ${it.artists.map((a) => a.name).join(", ")}`;
      } else if (it.type === "artist") {
        meta.textContent = "Artist";
      }

      text.appendChild(title);
      text.appendChild(meta);
      row.appendChild(text);
      li.appendChild(row);

      // Click navigation
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        navigateTo(it);
      });

      ul.appendChild(li);
    });

    searchResults.appendChild(ul);
    searchResults.classList.add("show");

    const listItems = ul.querySelectorAll<HTMLLIElement>("li");

    // Keyboard support
    input.onkeydown = (e) => {
      if (listItems.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        currentIndex = (currentIndex + 1) % listItems.length;
        updateSelection();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        currentIndex = (currentIndex - 1 + listItems.length) % listItems.length;
        updateSelection();
      } else if (e.key === "Enter" && currentIndex >= 0) {
        e.preventDefault();
        const selected = items[currentIndex];
        navigateTo(selected);
      } else if (e.key === "Escape") {
        searchResults.classList.remove("show");
      }
    };

    function updateSelection() {
      listItems.forEach((li, i) =>
        li.classList.toggle("selected", i === currentIndex)
      );

      const active = listItems[currentIndex];
      if (active) active.scrollIntoView({ block: "nearest" });
    }

    function navigateTo(item: SpotifyItem) {
      const url = `/detail.html#/${item.type}/${item.id}`;
      console.log("Navigating to:", url);
      window.location.href = url;
    }
  }
  // Optional: hide results when clearing search
  q.addEventListener("blur", () => {
    document.getElementById("search-results")?.classList.remove("show");
  });

  let selectedIndex = -1;
  let resultItems: HTMLLIElement[] = [];

  document.addEventListener("keydown", (e) => {
    if (!resultItems.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % resultItems.length;
      updateSelection();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + resultItems.length) % resultItems.length;
      updateSelection();
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      resultItems[selectedIndex].click();
    }
  });

  function updateSelection() {
    resultItems.forEach((item, i) => {
      item.classList.toggle("selected", i === selectedIndex);
      if (i === selectedIndex) item.scrollIntoView({ block: "nearest" });
    });
  }

  // --- Side menu ---
  const recentlyPlayedMenu = document.getElementById("menu-recently-played");
  const playlistsMenu = document.getElementById("menu-playlists");

  recentlyPlayedMenu?.addEventListener("click", () => {
    recentlyPlayedMenu.classList.add("active");
    playlistsMenu?.classList.remove("active");
    if (token) fetchRecentlyPlayed(token);
  });

  playlistsMenu?.addEventListener("click", () => {
    playlistsMenu.classList.add("active");
    recentlyPlayedMenu?.classList.remove("active");
    if (token) fetchUserPlaylists(token);
  });

  // --- Fetch recently played ---
  async function fetchRecentlyPlayed(token: string) {
    const res = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=20", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (wrap) wrap.innerHTML = `<div class="error">Failed to fetch recently played tracks</div>`;
      return;
    }

    const data = await res.json();
    renderTiles(data.items.map((i: any) => i.track));
  }

  // --- Fetch playlists ---
  async function fetchUserPlaylists(token: string) {
    const res = await fetch("https://api.spotify.com/v1/me/playlists?limit=20", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (wrap) wrap.innerHTML = `<div class="error">Failed to fetch playlists</div>`;
      return;
    }

    const data = await res.json();
    renderTiles(data.items);
  }

  // --- Render tiles ---
  function renderTiles(items: any[]) {
    if (!wrap) return;
    wrap.innerHTML = "";
    if (!items || items.length === 0) {
      wrap.textContent = "No items found.";
      return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      const tile = document.createElement("div");
      tile.className = "track-tile";

      const img = document.createElement("img");
      img.src = item.album?.images?.[0]?.url || item.images?.[0]?.url || "https://via.placeholder.com/150";

      const name = document.createElement("div");
      name.className = "track-name";
      name.textContent = item.name;

      const meta = document.createElement("div");
      meta.className = "track-meta";
      meta.textContent = item.artists?.map((a: any) => a.name).join(", ") || "";

      tile.appendChild(img);
      tile.appendChild(name);
      tile.appendChild(meta);

      tile.addEventListener("click", () => {
        window.location.href = `/detail.html#/${item.type || "playlist"}/${item.id}`;
      });

      fragment.appendChild(tile);
    });

    wrap.appendChild(fragment);
  }

  // --- Initial load ---
  if (token) {
    fetchUserProfile(token);
    fetchRecentlyPlayed(token);

    // set the correct active tab visually
    const recentlyPlayedMenu = document.getElementById("menu-recently-played");
    const playlistsMenu = document.getElementById("menu-playlists");
    recentlyPlayedMenu?.classList.add("active");
    playlistsMenu?.classList.remove("active");
  }
});
