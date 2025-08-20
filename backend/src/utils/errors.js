// backend/src/utils/errors.js
export function logAnd500(res, message, error) {
  console.error(message, error);
  return res.status(500).json({ message });
}