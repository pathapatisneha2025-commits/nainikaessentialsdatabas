// routes/settings.js
const express = require("express");
const router = express.Router();
const pool = require("../db"); // PostgreSQL pool connection

// ===== GET: fetch all settings =====
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM settings ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== GET: fetch single setting by ID =====
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM settings WHERE id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Setting not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== POST: create new setting =====
router.post("/", async (req, res) => {
  const { cod_charge } = req.body;
  if (cod_charge === undefined) return res.status(400).json({ error: "cod_charge required" });

  try {
    const result = await pool.query(
      "INSERT INTO settings(cod_charge) VALUES($1) RETURNING *",
      [cod_charge]
    );
    res.status(201).json({ message: "Setting created", setting: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== PUT: update setting by ID =====
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { cod_charge } = req.body;
  if (cod_charge === undefined) return res.status(400).json({ error: "cod_charge required" });

  try {
    const result = await pool.query(
      "UPDATE settings SET cod_charge = $1 WHERE id = $2 RETURNING *",
      [cod_charge, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Setting not found" });
    res.json({ message: "Setting updated", setting: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== DELETE: delete setting by ID =====
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM settings WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Setting not found" });
    res.json({ message: "Setting deleted", setting: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
