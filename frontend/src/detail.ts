declare const tinymce: any;

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
    const detail = document.getElementById("detail")!;
    detail.innerHTML = `
    <h1>${data.name}</h1>
    ${data.images?.[0] ? `<img class="cover" src="${data.images[0].url}" />` : ""}
    <h2>Followers: ${data.followers?.total ?? "n/a"}</h2>
    <h2>Genres: ${(data.genres || []).join(", ")}</h2>
  `;
}

function renderAlbum(data: any) {
    const detail = document.getElementById("detail")!;
    detail.innerHTML = `
    <div class="flip-card">
      <div class="flip-card-inner">
        <div class="flip-card-front">
          <button class="review-btn">Write a Review</button>
          <h1>${data.name}</h1>
          ${data.images?.[0] ? `<img class="cover" src="${data.images[0].url}" />` : ""}
          <h2>By: ${data.artists?.map((a: any) => a.name).join(", ")}</h2>
          <h2>Release: ${data.release_date}</h2>
        </div>

        <div class="flip-card-back">
          <div class="review-form">
            <div class="star-rating">
              ${[1, 2, 3, 4, 5]
            .map(i => `<span class="star" data-value="${i}">★</span>`)
            .join("")}
            </div>
            <textarea id="review-text" placeholder="Write your thoughts..." rows="5"></textarea>
            <div class="form-actions">
              <button id="cancel-review">Cancel</button>
              <button id="submit-review">Submit</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

    tinymce.remove(); // clear previous editors if any
    tinymce.init({
        selector: '#review-text',
        menubar: false,
        branding: false,
        height: 250,
        skin: 'oxide-dark',
        content_css: 'dark',
        toolbar: 'undo redo | bold italic underline | bullist numlist | link',
        placeholder: 'Write your thoughts...',
    });

    // ✅ Attach event listeners after DOM insertion
    setTimeout(() => {
        const cardInner = detail.querySelector(".flip-card-inner") as HTMLElement;
        const reviewBtn = detail.querySelector(".review-btn") as HTMLButtonElement;
        const cancelBtn = detail.querySelector("#cancel-review") as HTMLButtonElement;
        const submitBtn = detail.querySelector("#submit-review") as HTMLButtonElement;
        const stars = detail.querySelectorAll(".star");

        let selectedRating = 0;

        // Flip to review form
        reviewBtn.addEventListener("click", () => {
            cardInner.classList.add("flipped");
        });

        // Cancel and flip back
        cancelBtn.addEventListener("click", () => {
            cardInner.classList.remove("flipped");
        });

        // Star rating selection
        stars.forEach(star => {
            star.addEventListener("click", (e) => {
                const target = e.target as HTMLElement;
                const value = parseInt(target.dataset.value!);
                selectedRating = value;

                stars.forEach(s => {
                    const el = s as HTMLElement;
                    el.classList.toggle("active", parseInt(el.dataset.value!) <= selectedRating);
                });
            });
        });

        // Submit placeholder
        submitBtn.addEventListener("click", () => {
            const text = tinymce.get('review-text')?.getContent() || '';
            console.log("Review Submitted:", { rating: selectedRating, text });
            cardInner.classList.remove("flipped");
        });
    }, 0);
}

function renderTrack(data: any) {
    const detail = document.getElementById("detail")!;
    detail.innerHTML = `
    <h1>${data.name}</h1>
    ${data.album?.images?.[0] ? `<img class="cover" src="${data.album.images[0].url}" />` : ""}
    <h2>By: ${data.artists?.map((a: any) => a.name).join(", ")}</h2>
    <h2>Album: ${data.album?.name ?? ""}</h2>
    <h2>Preview: ${data.preview_url ? `<audio controls src="${data.preview_url}"></audio>` : ""}</h2>
  `;
}

(async function main() {
    const parsed = parseHash();
    if (!parsed) {
        document.getElementById("detail")!.innerHTML = "<h2>No item specified</h2>";
        return;
    }
    const t = await getToken();
    const d = await fetchDetail(parsed.type, parsed.id, t);
    if (parsed.type === "artist") renderArtist(d);
    else if (parsed.type === "album") renderAlbum(d);
    else if (parsed.type === "track") renderTrack(d);
    else document.getElementById("detail")!.innerHTML = "<h2>Unsupported type</h2>";
})();
