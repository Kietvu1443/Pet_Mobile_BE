const { pool } = require("../config/db");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { generatePetToken, parsePetToken } = require("../utils/petQrToken");
const PetScan = require("../models/PetScan");
const UserPet = require("../models/UserPet");
const UserPetImage = require("../models/UserPetImage");
const Pet = require("../models/Pet");
const PetImage = require("../models/PetImage");

const CANONICAL_BASE_URL = "https://pethelper.app/pet";

const publicPetApiV1Controller = {
  /**
   * Resolves a public opaque token or pet_code to public pet details.
   * Public route — No authentication required.
   * Uses a strict allow-list to ensure ZERO private owner data is exposed.
   */
  async resolvePublicPet(req, res) {
    try {
      const { token } = req.params;
      if (!token) {
        return sendError(res, 400, "Mã token thú cưng không hợp lệ");
      }

      const parsed = parsePetToken(token);
      if (!parsed) {
        return sendError(res, 404, "QR không hợp lệ hoặc thú cưng không còn tồn tại");
      }

      // 1. Resolve User Pet (from My Pets)
      if (parsed.type === "user_pet") {
        const petId = Number(parsed.id);
        const [rows] = await pool.query(
          `SELECT
             id, name, species, breed, gender, birth_date, color,
             weight, vaccinated, description, traits, image_url
           FROM user_pets
           WHERE id = ?`,
          [petId]
        );

        if (!rows || rows.length === 0) {
          return sendError(res, 404, "Thú cưng không tồn tại hoặc đã bị xóa");
        }

        const pet = rows[0];
        const images = await UserPetImage.findByUserPetId(petId);

        let parsedTraits = [];
        if (typeof pet.traits === "string") {
          try {
            parsedTraits = JSON.parse(pet.traits);
          } catch {
            parsedTraits = [];
          }
        } else if (Array.isArray(pet.traits)) {
          parsedTraits = pet.traits;
        }

        // Strict public allow-list: zero owner fields (user_id, email, phone excluded)
        const publicData = {
          token,
          canonicalUrl: `${CANONICAL_BASE_URL}/${token}`,
          category: "user_pet",
          name: pet.name,
          species: pet.species || "pet",
          breed: pet.breed || "",
          gender: pet.gender || "",
          birth_date: pet.birth_date || null,
          color: pet.color || "",
          weight: pet.weight ? Number(pet.weight) : null,
          vaccinated: Boolean(pet.vaccinated),
          description: pet.description || "",
          traits: parsedTraits,
          image_url: pet.image_url || (images.length > 0 ? images[0].image_path : null),
          images: images.map((img) => ({
            id: img.id,
            image_path: img.image_path,
          })),
        };

        return sendSuccess(res, 200, "Lấy thông tin thú cưng công khai thành công", {
          pet: publicData,
        });
      }

      // 2. Resolve Shelter Pet (from adoption catalog)
      if (parsed.type === "shelter_pet" || parsed.type === "shelter_pet_code") {
        let pet = null;
        if (parsed.type === "shelter_pet") {
          pet = await Pet.findById(parsed.id);
        } else {
          const [rows] = await pool.query(
            "SELECT * FROM pets WHERE pet_code = ? LIMIT 1",
            [parsed.petCode]
          );
          if (rows && rows.length > 0) pet = rows[0];
        }

        if (!pet) {
          return sendError(res, 404, "Thú cưng cứu hộ không tồn tại hoặc đã được nhận nuôi");
        }

        const images = await PetImage.findByPetId(pet.id);

        // Record scan event in pet_scans (telemetry is fail-soft)
        try {
          const userId = req.user && req.user.id ? Number(req.user.id) : null;
          await PetScan.create({
            user_id: userId,
            pet_id: pet.id,
            referrer: "qr_share",
            device_platform: req.headers["user-agent"] ? req.headers["user-agent"].slice(0, 50) : "web/app",
          });
        } catch (telemetryErr) {
          console.warn("[PublicPet API] Scan telemetry recording skipped:", telemetryErr.message);
        }

        // Strict public allow-list for shelter pet
        const publicData = {
          token,
          canonicalUrl: `${CANONICAL_BASE_URL}/${token}`,
          category: "shelter_pet",
          name: pet.name,
          species: pet.pet_type || "pet",
          breed: pet.breed || "",
          gender: pet.gender || "",
          age: pet.age || "",
          color: pet.color || "",
          weight: pet.weight ? String(pet.weight) : "",
          vaccinated: Boolean(pet.vaccination),
          description: pet.description || "",
          pet_code: pet.pet_code || "",
          status: pet.status || "available",
          image_url: pet.image_url || (images.length > 0 ? images[0].image_path : null),
          images: images.map((img) => ({
            id: img.id,
            image_path: img.image_path,
          })),
        };

        return sendSuccess(res, 200, "Lấy thông tin thú cưng cứu hộ thành công", {
          pet: publicData,
        });
      }

      return sendError(res, 404, "Không xác định được loại thú cưng");
    } catch (error) {
      console.error("[PublicPet API v1] resolvePublicPet error:", error);
      return sendError(res, 500, "Không thể tải thông tin thú cưng");
    }
  },

  /**
   * Generates QR share info for a User Pet (My Pets).
   * Authenticated route — requires owner access.
   */
  async getUserPetShareQr(req, res) {
    try {
      const userId = req.user && req.user.id ? Number(req.user.id) : null;
      if (!userId) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const petId = Number(req.params.id);
      if (!petId || isNaN(petId)) {
        return sendError(res, 400, "ID thú cưng không hợp lệ");
      }

      const pet = await UserPet.findByIdAndUserId(petId, userId);
      if (!pet) {
        return sendError(res, 404, "Không tìm thấy thú cưng hoặc bạn không có quyền truy cập");
      }

      const token = generatePetToken("up", pet.id);
      const canonicalUrl = `${CANONICAL_BASE_URL}/${token}`;

      return sendSuccess(res, 200, "Tạo mã QR chia sẻ thú cưng thành công", {
        token,
        canonicalUrl,
        pet: {
          id: pet.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          image_url: pet.image_url,
        },
      });
    } catch (error) {
      console.error("[PublicPet API v1] getUserPetShareQr error:", error);
      return sendError(res, 500, "Không thể tạo mã QR thú cưng");
    }
  },

  /**
   * Generates QR share info for a Shelter Pet.
   * Public or authenticated.
   */
  async getShelterPetShareQr(req, res) {
    try {
      const petId = Number(req.params.id);
      if (!petId || isNaN(petId)) {
        return sendError(res, 400, "ID thú cưng không hợp lệ");
      }

      const pet = await Pet.findById(petId);
      if (!pet) {
        return sendError(res, 404, "Không tìm thấy thú cưng cứu hộ");
      }

      // Generate opaque token
      const token = generatePetToken("sp", pet.id);
      const canonicalUrl = `${CANONICAL_BASE_URL}/${token}`;

      return sendSuccess(res, 200, "Tạo mã QR thú cưng cứu hộ thành công", {
        token,
        canonicalUrl,
        pet: {
          id: pet.id,
          name: pet.name,
          species: pet.pet_type,
          breed: pet.breed,
          pet_code: pet.pet_code,
          image_url: pet.image_url,
        },
      });
    } catch (error) {
      console.error("[PublicPet API v1] getShelterPetShareQr error:", error);
      return sendError(res, 500, "Không thể tạo mã QR thú cưng cứu hộ");
    }
  },
};

module.exports = publicPetApiV1Controller;
