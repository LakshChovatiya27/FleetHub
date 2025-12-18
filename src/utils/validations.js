export const isEmpty = (field) => {
  if (typeof field === "string") {
    if (field?.trim() === "") return true;
    else return false;
  } 
  else if (!field) return true;
  else return false;
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