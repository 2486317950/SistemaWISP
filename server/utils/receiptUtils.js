/**
 * Utilidades para números de recibo (formato REC-...).
 * Usado por payments, receipts, paymentProofs, creditPaymentProofs, credits.
 */
function getInitials(name) {
  if (!name || typeof name !== 'string') return '';
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return words.slice(0, 3).map((word) => word[0].toUpperCase()).join('');
}

function generateReceiptNumber(clientName = null) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const initials = clientName ? getInitials(clientName) : '';
  return initials ? `REC-${initials}-${timestamp}-${random}` : `REC-${timestamp}-${random}`;
}

module.exports = { getInitials, generateReceiptNumber };
