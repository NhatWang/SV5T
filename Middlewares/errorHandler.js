/**
 * Centralized error handler — đặt cuối cùng trong server.js sau tất cả routes.
 *
 * Cách dùng trong route:
 *   router.get("/foo", async (req, res, next) => {
 *     try { ... }
 *     catch (err) { next(err); }   // chuyển lỗi về đây
 *   });
 *
 * Hoặc với Express 5 (dự án đang dùng express ^5):
 *   async function đã tự forward unhandled rejection về next() — không cần try/catch.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Lỗi server không xác định";

  // Không lộ stack trace trên production
  const response = {
    success: false,
    message
  };

  if (process.env.NODE_ENV !== "production") {
    response.stack = err.stack;
  }

  // Ghi log lỗi 500 để dễ debug
  if (status >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${status}:`, err.message);
  }

  res.status(status).json(response);
}

module.exports = errorHandler;