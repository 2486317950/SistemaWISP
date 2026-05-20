// Fecha operativa YYYY-MM-DD en zona fija UTC−6 (ver server/utils/businessTime.js)
const { getBusinessYearMonthDay } = require('./businessTime');

const getLocalDateString = (date = new Date()) => getBusinessYearMonthDay(date);

module.exports = {
  getLocalDateString,
};

