import express from "express";
import { getConnection } from "../db/connection.js";

const router = express.Router();

// Add review
router.post("/", async (req, res) => {
    const { userId, spotifyItemId, itemType, rating, reviewText } = req.body;
    try {
        const pool = await getConnection();
        await pool.request()
            .input("UserId", userId)
            .input("SpotifyItemId", spotifyItemId)
            .input("ItemType", itemType)
            .input("Rating", rating)
            .input("ReviewText", reviewText)
            .query(`
        INSERT INTO Reviews (UserId, SpotifyItemId, ItemType, Rating, ReviewText)
        VALUES (@UserId, @SpotifyItemId, @ItemType, @Rating, @ReviewText)
      `);
        res.status(201).json({ message: "Review added successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to add review" });
    }
});

// Get reviews for a specific item
router.get("/:spotifyItemId", async (req, res) => {
    const { spotifyItemId } = req.params;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("SpotifyItemId", spotifyItemId)
            .query(`
        SELECT R.*, U.DisplayName
        FROM Reviews R
        JOIN Users U ON R.UserId = U.Id
        WHERE R.SpotifyItemId = @SpotifyItemId
        ORDER BY R.CreatedAt DESC
      `);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch reviews" });
    }
});

// Like a review
router.post("/:id/like", async (req, res) => {
    try {
        const pool = await getConnection();
        await pool.request()
            .input("Id", req.params.id)
            .query("UPDATE Reviews SET Likes = Likes + 1 WHERE Id = @Id");
        res.json({ message: "Review liked" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to like review" });
    }
});

export default router;
