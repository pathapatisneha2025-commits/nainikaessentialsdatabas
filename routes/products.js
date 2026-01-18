const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const { Readable } = require("stream");
const cloudinary = require("../cloudinary");

/* ================================
   MULTER MEMORY STORAGE
================================ */
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

/* ================================
   CLOUDINARY BUFFER UPLOAD HELPER
================================ */
const uploadToCloudinary = (buffer, folder = "elanproducts") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );

    const readable = new Readable();
    readable._read = () => {};
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
};

/* ======================================================
   ADD PRODUCT (MULTIPLE IMAGES + SUBCATEGORY)
====================================================== */
router.post("/add", upload.array("images", 5), async (req, res) => {
  try {
    const {
      name,
      category,
      subcategory,
      price,
      stock,
      is_new,
      is_bestseller,
      is_featured,
    } = req.body;

    let imageUrls = [];
    if (req.files?.length) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer);
        imageUrls.push(result.secure_url);
      }
    }

    const result = await pool.query(
      `INSERT INTO elanproducts 
      (name, category, subcategory, price, stock, images, is_new, is_bestseller, is_featured)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        name,
        category,
        subcategory,
        price,
        stock,
        imageUrls,
        is_new === "true",
        is_bestseller === "true",
        is_featured === "true",
      ]
    );

    res.json({ product: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


/* ======================================================
   UPDATE PRODUCT (OPTIONAL IMAGE REPLACE + SUBCATEGORY)
====================================================== */
router.put("/update/:id", upload.array("images", 5), async (req, res) => {
  try {
    const {
      name,
      category,
      subcategory,
      price,
      stock,
      is_new,
      is_bestseller,
      is_featured,
      existingImages,
    } = req.body;

    let imageUrls = existingImages
      ? JSON.parse(existingImages)
      : [];

    if (req.files?.length) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer);
        imageUrls.push(result.secure_url);
      }
    }

    const result = await pool.query(
      `UPDATE elanproducts
       SET name=$1, category=$2, subcategory=$3, price=$4, stock=$5,
           images=$6, is_new=$7, is_bestseller=$8, is_featured=$9
       WHERE id=$10
       RETURNING *`,
      [
        name,
        category,
        subcategory,
        price,
        stock,
        imageUrls,
        is_new === "true",
        is_bestseller === "true",
        is_featured === "true",
        req.params.id,
      ]
    );

    res.json({ product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


/* ======================================================
   GET ALL PRODUCTS
====================================================== */
router.get("/all", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM elanproducts ORDER BY id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================================================
   GET PRODUCT BY ID
====================================================== */
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM elanproducts WHERE id=$1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
router.get("/new", async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM elanproducts WHERE is_new=true ORDER BY created_at DESC`
  );
  res.json(result.rows);
});

router.get("/bestsellers", async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM elanproducts WHERE is_bestseller=true`
  );
  res.json(result.rows);
});

router.get("/featured", async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM elanproducts WHERE is_featured=true`
  );
  res.json(result.rows);
});

/* ======================================================
   UPDATE STOCK ONLY
====================================================== */
router.patch("/stock/:id", async (req, res) => {
  try {
    const { stock } = req.body;

    const result = await pool.query(
      `UPDATE elanproducts SET stock=$1 WHERE id=$2 RETURNING *`,
      [stock, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================================================
   DELETE PRODUCT
====================================================== */
router.delete("/delete/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM elanproducts WHERE id=$1`, [
      req.params.id,
    ]);

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================================================
   SEARCH PRODUCTS
====================================================== */
router.get("/search/:query", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM elanproducts WHERE name ILIKE $1`,
      [`%${req.params.query}%`]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
