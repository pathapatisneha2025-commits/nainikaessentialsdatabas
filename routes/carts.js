const express = require("express");
const router = express.Router();
const pool = require("../db");

/* ======================================================
   GET CART BY USER
====================================================== */
router.get("/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query(
      `SELECT * FROM elan_cart WHERE user_id=$1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.json({ user_id, items: [] }); // empty cart
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================================================
   ADD ITEM TO CART
====================================================== */
router.post("/add", async (req, res) => {
  try {
    const { user_id, product } = req.body;
    /**
     * product = {
     *   product_id: 201,
     *   selected_size: "M",
     *   selected_color: "Red",
     *   quantity: 2,
     *   price_at_addition: 1299.99,
     *   product_name: "Elegant Black Hoodie",
     *   product_images: ["/images/blackhoodie1.jpeg"]
     * }
     */

    // Check if user already has a cart
    const cartRes = await pool.query(
      `SELECT * FROM elan_cart WHERE user_id=$1`,
      [user_id]
    );

    if (cartRes.rows.length === 0) {
      // Create new cart
      const newCart = await pool.query(
        `INSERT INTO elan_cart (user_id, items) VALUES ($1, $2) RETURNING *`,
        [user_id, JSON.stringify([product])]
      );
      return res.json(newCart.rows[0]);
    }

    // User already has cart -> update JSONB
    const cart = cartRes.rows[0];
    let items = cart.items;

    // Check if product with same size/color already exists
    const index = items.findIndex(
      (item) =>
        item.product_id === product.product_id &&
        item.selected_size === product.selected_size &&
        item.selected_color === product.selected_color
    );

    if (index >= 0) {
      // Increment quantity
      items[index].quantity += product.quantity;
    } else {
      // Add new item
      items.push(product);
    }

    const updatedCart = await pool.query(
      `UPDATE elan_cart SET items=$1 WHERE id=$2 RETURNING *`,
      [JSON.stringify(items), cart.id]
    );

    res.json(updatedCart.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================================================
   UPDATE A CART ITEM
====================================================== */
router.patch("/update/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { product_id, selected_size, selected_color, quantity } = req.body;

    const cartRes = await pool.query(
      `SELECT * FROM elan_cart WHERE user_id=$1`,
      [user_id]
    );

    if (cartRes.rows.length === 0) {
      return res.status(404).json({ error: "Cart not found" });
    }

    let items = cartRes.rows[0].items;

    const index = items.findIndex(
      (item) =>
        item.product_id === product_id &&
        item.selected_size === selected_size &&
        item.selected_color === selected_color
    );

    if (index === -1) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    // Update quantity
    items[index].quantity = quantity;

    const updatedCart = await pool.query(
      `UPDATE elan_cart SET items=$1 WHERE user_id=$2 RETURNING *`,
      [JSON.stringify(items), user_id]
    );

    res.json(updatedCart.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================================================
   REMOVE ITEM FROM CART
====================================================== */
router.delete("/remove/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { product_id, selected_size, selected_color } = req.body;

    const cartRes = await pool.query(
      `SELECT * FROM elan_cart WHERE user_id=$1`,
      [user_id]
    );

    if (cartRes.rows.length === 0) {
      return res.status(404).json({ error: "Cart not found" });
    }

    let items = cartRes.rows[0].items;

    // Remove matching item
    items = items.filter(
      (item) =>
        !(
          item.product_id === product_id &&
          item.selected_size === selected_size &&
          item.selected_color === selected_color
        )
    );

    const updatedCart = await pool.query(
      `UPDATE elan_cart SET items=$1 WHERE user_id=$2 RETURNING *`,
      [JSON.stringify(items), user_id]
    );

    res.json(updatedCart.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
