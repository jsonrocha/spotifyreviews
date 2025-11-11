import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import reviewsRoutes from "./routes/reviews.js";
import followsRoutes from "./routes/follows.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/reviews", reviewsRoutes);
app.use("/api/follows", followsRoutes);
app.use("/auth", authRoutes);
app.get("/", (req, res) => res.send("Spotify Review API running."));

const CLIENT_ID = process.env.SPOTIFY_CLIENT_URL;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || "http://localhost:3001/callback";

console.log("CLIENT_ID:", CLIENT_ID);

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn("Set CLIENT_ID and CLIENT_SECRET in backend/.env");
}

let cached = { token: null, expiresAt: 0 };

async function fetchToken() {
    if (cached.token && Date.now() < cached.expiresAt - 5000) return cached.token;

    const b64 = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    const resp = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${b64}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });
    const data = await resp.json();
    if (data.access_token) {
        cached.token = data.access_token;
        cached.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
        return cached.token;
    }
    throw new Error("Failed to fetch Spotify token: " + JSON.stringify(data));
}

app.get("/login", (req, res) => {
    const scope = "user-read-recently-played playlist-read-private playlist-read-collaborative user-library-read user-read-private user-read-email";
    const url = new URL("https://accounts.spotify.com/authorize");
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("scope", scope);
    url.searchParams.set("show_dialog", "true"); // forces login prompt
    res.redirect(url.toString());
});

app.get("/callback", async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send("Missing authorization code");

    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
    });

    try {
        const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });

        const data = await tokenRes.json();

        // 🧠 Catch cases where Spotify returns an error instead of a token
        if (!tokenRes.ok || !data.access_token) {
            console.error("Spotify token exchange failed:", data);

            // Return a small HTML page that sends the error back to the opener
            return res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage(
                  { error: "auth_failed", details: ${JSON.stringify(data)} },
                  "*"
                );
                window.close();
              } else {
                window.location.href = "http://localhost:5173?error=auth_failed";
              }
            </script>
            <p>Login failed. Please close this window and try again.</p>
          </body>
        </html>
      `);
        }

        const accessToken = data.access_token;
        const refreshToken = data.refresh_token;

        // ✅ Normal success flow — send the token to the opener window
        res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage(
                { access_token: "${accessToken}", refresh_token: "${refreshToken}" },
                "*"
              );
              window.close();
            } else {
              window.location.href = "http://localhost:5173?access_token=${accessToken}";
            }
          </script>
          <p>Logging you in...</p>
        </body>
      </html>
    `);
    } catch (err) {
        console.error("Callback error:", err);
        res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage(
                { error: "server_error", details: "${err.message}" },
                "*"
              );
              window.close();
            } else {
              window.location.href = "http://localhost:5173?error=server_error";
            }
          </script>
          <p>Something went wrong. Please close this window and try again.</p>
        </body>
      </html>
    `);
    }
});


app.get("/token", async (req, res) => {
    try {
        const token = await fetchToken();
        res.json({ access_token: token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "token_error", details: err.message });
    }
});

app.post("/refresh", async (req, res) => {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).send("Missing refresh token");

    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
    });

    try {
        const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });
        const data = await tokenRes.json();
        res.json({ access_token: data.access_token, expires_in: data.expires_in });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "refresh_error", details: err.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
