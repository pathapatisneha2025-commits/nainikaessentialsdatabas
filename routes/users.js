const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcrypt");

/* ======================================================
   USER REGISTRATION
====================================================== */
router.post("/register", async (req, res) => {
  try {
    const { full_name, email, phone_number, password } = req.body;

    // Check if user already exists
    const userCheck = await pool.query(
      `SELECT * FROM elan_users WHERE email=$1`,
      [email]
    );
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      `INSERT INTO elan_users (full_name, email, phone_number, password_hash)
       VALUES ($1,$2,$3,$4)
       RETURNING user_id, full_name, email, phone_number, created_at`,
      [full_name, email, phone_number, hashedPassword]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================================================
   SIMPLE USER LOGIN
====================================================== */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const userRes = await pool.query(
      `SELECT * FROM elan_users WHERE email=$1`,
      [email]
    );
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const user = userRes.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Return user info directly (no JWT)
    res.json({
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
/* ======================================================
   GET ALL USERS
====================================================== */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT user_id, full_name, email, phone_number, created_at FROM elan_users`
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================================================
   GET USER BY ID
====================================================== */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT user_id, full_name, email, phone_number, created_at 
       FROM elan_users 
       WHERE user_id=$1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
