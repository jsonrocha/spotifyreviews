async function getToken() {
    const res = await fetch("http://localhost:3001/token");
    const data = await res.json();
    return data.access_token;
}

function parseHash() {
    const hash = location.hash || "";
    // format: #/type/id
    const parts = hash.replace(/^#\/?/, "").split("/");
    if (parts.length >= 2) {
        return { type: parts[0], id: parts[1] };
    }
    return null;
}

async function fetchDetail(type: string, id: string, token: string) {
    const url = `https://api.spotify.com/v1/${type}s/${id}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    return await resp.json();
}

function renderArtist(data: any) {
    const root = document.getElementById("root")!;
    root.innerHTML = `
    <h1>${data.name}</h1>
    ${data.images?.[0] ? `<img class="cover" src="${data.images[0].url}" />` : ""}
    <p class="muted">Followers: ${data.followers?.total ?? "n/a"}</p>
    <p class="muted">Genres: ${(data.genres || []).join(", ")}</p>
  `;
}

function renderAlbum(data: any) {
    const root = document.getElementById("root")!;
    root.innerHTML = `
    <h1>${data.name}</h1>
    ${data.images?.[0] ? `<img class="cover" src="${data.images[0].url}" />` : ""}
    <p class="muted">By: ${data.artists?.map((a: any) => a.name).join(", ")}</p>
    <p class="muted">Release: ${data.release_date}</p>
    <h3>Tracks</h3>
    <ol>${(data.tracks?.items || []).map((t: any) => `<li>${t.name}</li>`).join("")}</ol>
  `;
}

function renderTrack(data: any) {
    const root = document.getElementById("root")!;
    root.innerHTML = `
    <h1>${data.name}</h1>
    ${data.album?.images?.[0] ? `<img class="cover" src="${data.album.images[0].url}" />` : ""}
    <p class="muted">By: ${data.artists?.map((a: any) => a.name).join(", ")}</p>
    <p class="muted">Album: ${data.album?.name ?? ""}</p>
    ${data.preview_url ? `<audio controls src="${data.preview_url}"></audio>` : ""}
  `;
}

(async function main() {
    const parsed = parseHash();
    if (!parsed) {
        document.getElementById("root")!.innerHTML = "<p class='muted'>No item specified</p>";
        return;
    }
    const t = await getToken();
    const d = await fetchDetail(parsed.type, parsed.id, t);
    if (parsed.type === "artist") renderArtist(d);
    else if (parsed.type === "album") renderAlbum(d);
    else if (parsed.type === "track") renderTrack(d);
    else document.getElementById("root")!.innerHTML = "<p class='muted'>Unsupported type</p>";
})();
