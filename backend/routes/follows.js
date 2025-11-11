import express from "express";
import { getConnection } from "../db/connection.js";

const router = express.Router();

// Follow user
router.post("/", async (req, res) => {
    const { followerId, followingId } = req.body;
    try {
        const pool = await getConnection();
        await pool.request()
            .input("FollowerId", followerId)
            .input("FollowingId", followingId)
            .query(`
        IF NOT EXISTS (
          SELECT 1 FROM Follows WHERE FollowerId = @FollowerId AND FollowingId = @FollowingId
        )
        INSERT INTO Follows (FollowerId, FollowingId)
        VALUES (@FollowerId, @FollowingId)
      `);
        res.status(201).json({ message: "Now following user" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to follow user" });
    }
});

// Unfollow user
router.delete("/", async (req, res) => {
    const { followerId, followingId } = req.body;
    try {
        const pool = await getConnection();
        await pool.request()
            .input("FollowerId", followerId)
            .input("FollowingId", followingId)
            .query(`
        DELETE FROM Follows
        WHERE FollowerId = @FollowerId AND FollowingId = @FollowingId
      `);
        res.json({ message: "Unfollowed user" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to unfollow user" });
    }
});

// Get followers
router.get("/:userId/followers", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("UserId", req.params.userId)
            .query(`
        SELECT U.Id, U.DisplayName
        FROM Follows F
        JOIN Users U ON F.FollowerId = U.Id
        WHERE F.FollowingId = @UserId
      `);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch followers" });
    }
});

// Get following
router.get("/:userId/following", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("UserId", req.params.userId)
            .query(`
        SELECT U.Id, U.DisplayName
        FROM Follows F
        JOIN Users U ON F.FollowingId = U.Id
        WHERE F.FollowerId = @UserId
      `);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch following" });
    }
});

export default router;
