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

    const cart = result.rows[0];

    // Ensure items is parsed as an array
    cart.items = cart.items ? JSON.parse(cart.items) : [];
    res.json(cart);
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

    // Ensure product object is valid
    if (!product?.product_id) {
      return res.status(400).json({ error: "Invalid product data" });
    }

    // Get user's cart
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

    // Update existing cart
    const cart = cartRes.rows[0];
    let items = cart.items || [];

    const index = items.findIndex(
      (item) =>
        item?.product_id === product.product_id &&
        item?.selected_size === product.selected_size &&
        item?.selected_color === product.selected_color
    );

    if (index >= 0) {
      items[index].quantity += product.quantity;
    } else {
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
   UPDATE CART ITEM
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

    let items = cartRes.rows[0].items || [];

    const index = items.findIndex(
      (item) =>
        item?.product_id === product_id &&
        item?.selected_size === selected_size &&
        item?.selected_color === selected_color
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

    let items = cartRes.rows[0].items || [];

    // Remove matching item
    items = items.filter(
      (item) =>
        !(
          item?.product_id === product_id &&
          item?.selected_size === selected_size &&
          item?.selected_color === selected_color
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
