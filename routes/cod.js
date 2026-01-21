const express = require("express");
const router = express.Router();
const pool = require("../db");

/* =========================
   GET: Fetch all COD settings
   ========================= */
router.get("/all", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM cashondelivery ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   GET: Fetch COD by ID
   ========================= */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM cashondelivery WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "COD setting not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   POST: Create COD charge
   ========================= */
router.post("/add", async (req, res) => {
  const { cod_charge } = req.body;

  if (cod_charge === undefined) {
    return res.status(400).json({ error: "cod_charge required" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO cashondelivery (cod_charge) VALUES ($1) RETURNING *",
      [cod_charge]
    );

    res.status(201).json({
      message: "COD charge created",
      setting: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   PUT: Update COD charge
   ========================= */
router.put("/update/:id", async (req, res) => {
  const { id } = req.params;
  const { cod_charge } = req.body;

  if (cod_charge === undefined) {
    return res.status(400).json({ error: "cod_charge required" });
  }

  try {
    const result = await pool.query(
      "UPDATE cashondelivery SET cod_charge = $1 WHERE id = $2 RETURNING *",
      [cod_charge, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "COD setting not found" });
    }

    res.json({
      message: "COD charge updated",
      setting: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   DELETE: Delete COD charge
   ========================= */
router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM cashondelivery WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "COD setting not found" });
    }

    res.json({
      message: "COD charge deleted",
      setting: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
