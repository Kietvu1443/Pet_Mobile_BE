function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const bestMatchValidation = {
  validateCancel(body) {
    const reason = body && body.reason !== undefined ? String(body.reason).trim() : null;
    if (reason && reason.length > 500) {
      throw createError(400, "Lý do huỷ không được vượt quá 500 ký tự");
    }
    return { reason: reason || null };
  },

  validatePrivacyUpdate(body) {
    const allowedVisibility = ["private", "connections", "public"];
    const fields = {};

    if (body.profile_visibility !== undefined) {
      if (!allowedVisibility.includes(body.profile_visibility)) {
        throw createError(400, `profile_visibility không hợp lệ. Cho phép: ${allowedVisibility.join(", ")}`);
      }
      fields.profile_visibility = body.profile_visibility;
    }

    for (const key of ["show_duration", "show_stories", "show_media", "show_ring_badge"]) {
      if (body[key] !== undefined) {
        fields[key] = body[key] ? 1 : 0;
      }
    }

    return fields;
  },
};

module.exports = bestMatchValidation;
