const crypto = require("crypto");

const SECRET = process.env.JWT_SECRET || "pet-helper-jwt-secret-2026";
const SALT = "pet-helper-qr-salt-v1";
const ALGORITHM = "aes-256-gcm";

// Derive 32-byte key once
let derivedKey = null;
function getKey() {
  if (!derivedKey) {
    derivedKey = crypto.scryptSync(SECRET, SALT, 32);
  }
  return derivedKey;
}

/**
 * Encodes pet reference into an opaque, authenticated, URL-safe token.
 * @param {'up' | 'sp'} type - 'up' for user_pets, 'sp' for shelter pets
 * @param {number} id - The pet database ID
 * @returns {string} Opaque public token, e.g. "v1.7F8...B9C"
 */
function generatePetToken(type, id) {
  if (!type || !id || isNaN(Number(id))) {
    throw new Error("Invalid pet parameters for token generation");
  }

  const isUserPet = type === "up" || type === "user_pet";
  const payload = JSON.stringify({
    t: isUserPet ? "u" : "s",
    i: Number(id),
    n: crypto.randomBytes(4).toString("hex"), // Nonce for entropy
  });

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  
  let encrypted = cipher.update(payload, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  const ivB64 = iv.toString("base64url");
  const tagB64 = tag.toString("base64url");
  const dataB64 = encrypted.toString("base64url");

  return `v1.${ivB64}.${tagB64}.${dataB64}`;
}

/**
 * Decodes and authenticates an opaque public token.
 * @param {string} token - The public token from QR URL
 * @returns {{ type: 'user_pet' | 'shelter_pet', id: number } | null}
 */
function parsePetToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  // Handle canonical v1 token format
  if (token.startsWith("v1.")) {
    try {
      const parts = token.split(".");
      if (parts.length !== 4) return null;

      const iv = Buffer.from(parts[1], "base64url");
      const tag = Buffer.from(parts[2], "base64url");
      const data = Buffer.from(parts[3], "base64url");

      if (iv.length !== 12 || tag.length !== 16) return null;

      const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(data);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      const parsed = JSON.parse(decrypted.toString("utf8"));
      if (!parsed || !parsed.i) return null;

      return {
        type: parsed.t === "u" ? "user_pet" : "shelter_pet",
        id: Number(parsed.i),
      };
    } catch {
      return null; // Tampered or invalid token
    }
  }

  // Backward compatibility: If token matches shelter pet_code format (e.g. S5181, A4730)
  if (/^[A-Z]\d{4}$/.test(token)) {
    return {
      type: "shelter_pet_code",
      petCode: token,
    };
  }

  return null;
}

module.exports = {
  generatePetToken,
  parsePetToken,
};
