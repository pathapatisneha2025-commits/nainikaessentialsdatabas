const express = require("express");
const pool = require("../db");
const router = express.Router();

// Add Coupon
router.post("/add", async (req, res) => {
  const { code, discount_type, discount_value, applicable_products, applicable_categories, expiry_date } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, applicable_products, applicable_categories, expiry_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [code, discount_type, discount_value, applicable_products, applicable_categories, expiry_date || null]
    );
    res.status(201).json({ message: "Coupon added", coupon: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// Get All Coupons
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM coupons ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Coupon
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM coupons WHERE id=$1", [req.params.id]);
    res.json({ message: "Coupon deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Coupon
router.put("/:id", async (req, res) => {
  const { code, discount_type, discount_value, applicable_products, applicable_categories, expiry_date } = req.body;
  try {
    const result = await pool.query(
      `UPDATE coupons SET code=$1, discount_type=$2, discount_value=$3, applicable_products=$4, applicable_categories=$5, expiry_date=$6
       WHERE id=$7 RETURNING *`,
      [code, discount_type, discount_value, applicable_products, applicable_categories, expiry_date || null, req.params.id]
    );
    res.json({ message: "Coupon updated", coupon: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
