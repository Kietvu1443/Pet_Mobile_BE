const express = require("express");
const router = express.Router();
const notesController = require("../../../controller/notesApiV1Controller");
const { requireApiAuth } = require("../../../middleware/apiAuthV1");

router.get("/notes/:petId", requireApiAuth, notesController.getNote);
router.put("/notes/:petId", requireApiAuth, notesController.saveNote);
router.delete("/notes/:petId", requireApiAuth, notesController.deleteNote);

module.exports = router;
