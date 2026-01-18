const express = require("express");
const router = express.Router();
const pool = require("../db");

/* =====================================
   1️⃣ CREATE ORDER (Place Order)
===================================== */
router.post("/add", async (req, res) => {
  try {
    const {
      user_id,
      items,
      total_amount,
      shipping_address,
      payment_method,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO elan_orders
       (user_id, items, total_amount, order_status, shipping_address, payment_method, created_at)
       VALUES ($1, $2, $3, 'Pending', $4, $5, NOW())
       RETURNING *`,
      [user_id, items, total_amount, shipping_address, payment_method]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

/* =====================================
   2️⃣ GET ALL ORDERS (Admin)
===================================== */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM elan_orders ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

/* =====================================
   3️⃣ GET ORDERS BY USER ID
===================================== */
router.get("/user/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM elan_orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("User orders error:", err);
    res.status(500).json({ error: "Failed to fetch user orders" });
  }
});

/* =====================================
   4️⃣ GET SINGLE ORDER
===================================== */
router.get("/:order_id", async (req, res) => {
  try {
    const { order_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM elan_orders WHERE order_id = $1`,
      [order_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Order fetch error:", err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

/* =====================================
   5️⃣ UPDATE ORDER STATUS (Admin)
===================================== */
router.put("/:order_id/status", async (req, res) => {
  try {
    const { order_id } = req.params;
    const { order_status } = req.body;

    const result = await pool.query(
      `UPDATE elan_orders
       SET order_status = $1
       WHERE order_id = $2
       RETURNING *`,
      [order_status, order_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

/* =====================================
   6️⃣ UPDATE FULL ORDER (Optional)
===================================== */
router.put("/:order_id", async (req, res) => {
  try {
    const { order_id } = req.params;
    const {
      items,
      total_amount,
      shipping_address,
      payment_method,
    } = req.body;

    const result = await pool.query(
      `UPDATE elan_orders
       SET items = $1,
           total_amount = $2,
           shipping_address = $3,
           payment_method = $4
       WHERE order_id = $5
       RETURNING *`,
      [items, total_amount, shipping_address, payment_method, order_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update order error:", err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

/* =====================================
   7️⃣ DELETE ORDER (Admin)
===================================== */
router.delete("/:order_id", async (req, res) => {
  try {
    const { order_id } = req.params;

    await pool.query(
      `DELETE FROM elan_orders WHERE order_id = $1`,
      [order_id]
    );

    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("Delete order error:", err);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

module.exports = router;
