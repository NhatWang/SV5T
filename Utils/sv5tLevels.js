const AWARD_LEVELS = {
  TRUONG: "truong",
  DHQG: "dhqg",
  THANH: "thanh"
};

const awardLevelLabels = {
  truong: "Cấp Trường",
  dhqg: "Cấp ĐHQG-HCM",
  thanh: "Cấp Thành phố Hồ Chí Minh"
};

const validAwardLevels = Object.values(AWARD_LEVELS);

function normalizeAwardLevel(value) {
  if (!value) return AWARD_LEVELS.TRUONG;

  const normalized = String(value).trim();

  if (validAwardLevels.includes(normalized)) {
    return normalized;
  }

  return AWARD_LEVELS.TRUONG;
}

function getAwardLevelLabel(awardLevel) {
  return awardLevelLabels[awardLevel] || awardLevelLabels.truong;
}

function isHigherAwardLevel(awardLevel) {
  return awardLevel === "dhqg" || awardLevel === "thanh";
}

module.exports = {
  AWARD_LEVELS,
  awardLevelLabels,
  validAwardLevels,
  normalizeAwardLevel,
  getAwardLevelLabel,
  isHigherAwardLevel
};