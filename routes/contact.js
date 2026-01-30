// contactRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("./db"); // import pool from db.js

// Submit Contact Form
router.post("/contact", async (req, res) => {
  try {
    const { full_name, email, message } = req.body;

    const result = await pool.query(
      `INSERT INTO contact_messages (full_name, email, message) 
       VALUES ($1, $2, $3) RETURNING *`,
      [full_name, email, message]
    );

    res.status(201).json({ message: "Message saved", data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get All Messages (Admin)
router.get("/messages", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM contact_messages ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Update Status (Admin)
router.put("/messages/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // e.g., 'read' or 'replied'

    const result = await pool.query(
      "UPDATE contact_messages SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    res.json({ message: "Status updated", data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
