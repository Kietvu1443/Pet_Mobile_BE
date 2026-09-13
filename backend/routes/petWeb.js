const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { parsePetToken } = require("../utils/petQrToken");
const { pool } = require("../config/db");

const staticHtmlPath = path.join(__dirname, "..", "..", "frontend", "pages", "public-pet.html");
let cachedHtml = null;

// Web fallback for pet profile: https://pethelper.app/pet/:token
router.get("/:token", async (req, res) => {
  try {
    if (!cachedHtml) {
      cachedHtml = fs.readFileSync(staticHtmlPath, "utf8");
    }

    const { token } = req.params;
    const parsed = parsePetToken(token);

    if (!parsed) {
      res.setHeader("Content-Type", "text/html; charset=UTF-8");
      return res.status(200).send(cachedHtml);
    }

    let petName = "";
    let petBreed = "";

    if (parsed.type === "user_pet") {
      const [rows] = await pool.query("SELECT name, breed FROM user_pets WHERE id = ?", [parsed.id]);
      if (rows && rows.length > 0) {
        petName = rows[0].name;
        petBreed = rows[0].breed || "";
      }
    } else if (parsed.type === "shelter_pet") {
      const [rows] = await pool.query("SELECT name, breed FROM pets WHERE id = ?", [parsed.id]);
      if (rows && rows.length > 0) {
        petName = rows[0].name;
        petBreed = rows[0].breed || "";
      }
    } else if (parsed.type === "shelter_pet_code") {
      const [rows] = await pool.query("SELECT name, breed FROM pets WHERE pet_code = ?", [parsed.petCode]);
      if (rows && rows.length > 0) {
        petName = rows[0].name;
        petBreed = rows[0].breed || "";
      }
    }

    res.setHeader("Content-Type", "text/html; charset=UTF-8");

    if (petName) {
      const injectedHtml = cachedHtml
        .replace("<title>Hồ sơ thú cưng — Pet Helper</title>", `<title>${petName} — Hồ sơ thú cưng Pet Helper</title>`)
        .replace('<h1 id="petName" class="pet-name">Tên thú cưng</h1>', `<h1 id="petName" class="pet-name">${petName}</h1>`);
      return res.status(200).send(injectedHtml);
    }

    return res.status(200).send(cachedHtml);
  } catch (_err) {
    res.setHeader("Content-Type", "text/html; charset=UTF-8");
    return res.sendFile(staticHtmlPath);
  }
});

module.exports = router;
