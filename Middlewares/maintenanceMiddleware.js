const SystemSettings = require("../Models/SystemSettings");

let _cached = false;
let _cacheExpiry = 0;
const CACHE_TTL = 30_000; // 30 seconds

async function getMaintenanceStatus() {
  const now = Date.now();
  if (now < _cacheExpiry) return _cached;
  try {
    const doc = await SystemSettings.findOne({ key: "maintenanceMode" }).lean();
    _cached = doc?.value === true;
    _cacheExpiry = now + CACHE_TTL;
  } catch (e) {
    // keep cached value on DB error, don't crash
  }
  return _cached;
}

function invalidateMaintenanceCache() {
  _cacheExpiry = 0;
}

async function maintenanceMiddleware(req, res, next) {
  const active = await getMaintenanceStatus();
  if (!active) return next();
  return res.status(503).json({
    success: false,
    maintenance: true,
    message: "Hệ thống đang bảo trì, vui lòng quay lại sau."
  });
}

module.exports = { maintenanceMiddleware, invalidateMaintenanceCache, getMaintenanceStatus };
