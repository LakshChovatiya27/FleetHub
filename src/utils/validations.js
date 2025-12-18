export const isEmpty = (field) => {
  if (field === null || field === undefined) return true;
  if (Array.isArray(field)) return field.length === 0;
  if (typeof field === "string") return field.trim() === "";
  if (typeof field === "number") return Number.isNaN(field);
  if (typeof field === "boolean") return false;
  if (typeof field === "object") return Object.keys(field).length === 0;
  return false;
};

export const isEmailValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const isPasswordValid = (password) => password.length >= 6;

export const isPhoneNumberValid = (phoneNumber) => {
  const indianPhoneRegex = /^\d{10}$/;
  return indianPhoneRegex.test(phoneNumber);
};

export const isGSTValid = (gst) => {
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gst);
};