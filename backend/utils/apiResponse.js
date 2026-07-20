const sendResponse = (res, status, success, message, data = null) => {
  return res.status(status).json({ success, message, data });
};

const sendSuccess = (res, status, message, data = null) => {
  return sendResponse(res, status, true, message, data);
};

const sendError = (res, status, message, data = null) => {
  return sendResponse(res, status, false, message, data);
};

module.exports = {
  sendResponse,
  sendSuccess,
  sendError,
};
