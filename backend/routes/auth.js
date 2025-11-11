import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import { getConnection } from "../db/connection.js";

const router = express.Router();

router.get("/login", (req, res) => {
    const scope = "user-read-private user-read-email user-library-read user-read-recently-played";
    const redirectUri = "https://accounts.spotify.com/authorize" +
        `?client_id=${process.env.SPOTIFY_CLIENT_ID}` +
        "&response_type=code" +
        `&redirect_uri=${encodeURIComponent(process.env.SPOTIFY_REDIRECT_URI)}` +
        `&scope=${encodeURIComponent(scope)}`;
    res.redirect(redirectUri);
});

router.get("/callback", async (req, res) => {
    const code = req.query.code;
    try {
        const tokenRes = await axios.post("https://accounts.spotify.com/api/token", new URLSearchParams({
            code,
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            grant_type: "authorization_code",
        }), {
            headers: {
                Authorization: "Basic " + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        const { access_token } = tokenRes.data;
        const userRes = await axios.get("https://api.spotify.com/v1/me", {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        const pool = await getConnection();
        const user = userRes.data;
        const result = await pool.request()
            .input("SpotifyId", user.id)
            .input("DisplayName", user.display_name)
            .input("Email", user.email)
            .query(`
        MERGE Users AS target
        USING (SELECT @SpotifyId AS SpotifyId) AS src
        ON target.SpotifyId = src.SpotifyId
        WHEN MATCHED THEN UPDATE SET DisplayName = @DisplayName, Email = @Email
        WHEN NOT MATCHED THEN INSERT (SpotifyId, DisplayName, Email) VALUES (@SpotifyId, @DisplayName, @Email)
        OUTPUT inserted.*;
      `);

        const token = jwt.sign({ userId: result.recordset[0].Id }, process.env.JWT_SECRET);
        res.redirect(`${process.env.SPOTIFY_CLIENT_URL}?token=${token}`);
    } catch (err) {
        console.error(err.response?.data || err);
        res.status(500).send("Auth failed");
    }
});

export default router;
