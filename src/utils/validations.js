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

export const isPasswordValid = (password) =>
  typeof password === "string" && password.length >= 6;

export const isPhoneNumberValid = (phoneNumber) => {
  const indianPhoneRegex = /^\d{10}$/;
  return indianPhoneRegex.test(phoneNumber);
};

export const isGSTValid = (gst) => {
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gst);
};

export const validateIndianVehicleNumber = (number) => {
  if (!number) return null;

  const cleanNumber = number
    .toString()
    .replace(/[\s-.]/g, "")
    .toUpperCase();
  const regex = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/;

  if (regex.test(cleanNumber)) return cleanNumber;
  return null;
};

export const validateManufacturingYear = (year) => {
  if (year === null || year === undefined || year === "") {
    return "Manufacturing year is required";
  }

  const yearStr = String(year).trim();
  const currentYear = new Date().getFullYear();
  const yearRegex = /^\d{4}$/;

  if (!yearRegex.test(yearStr)) {
    return "Manufacturing year must be a valid 4-digit year (e.g., 2022)";
  }

  const yearNum = Number(yearStr);

  if (yearNum > currentYear) {
    return `Manufacturing year cannot be in the future (${yearNum})`;
  }

  if (yearNum < currentYear - 20) {
    return `Vehicle is too old to be registered (older than ${currentYear - 20})`;
  }

  return null;
};

export const validateLoadDates = ({
  biddingDeadline,
  pickupDate,
  expectedDeliveryDate,
  toleranceMinutes = 5,
}) => {
  const errors = {};

  const now = new Date();
  now.setMinutes(now.getMinutes() - toleranceMinutes);

  const parseDate = (value) => {
    const date = new Date(value);
    return date instanceof Date && !isNaN(date.getTime()) ? date : null;
  };

  const bidding = parseDate(biddingDeadline);
  const pickup = parseDate(pickupDate);
  const delivery = parseDate(expectedDeliveryDate);

  if (!bidding) errors.biddingDeadline = "Invalid bidding deadline date";
  if (!pickup) errors.pickupDate = "Invalid pickup date";
  if (!delivery) errors.expectedDeliveryDate = "Invalid delivery date";

  if (Object.keys(errors).length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  if (bidding < now) {
    errors.biddingDeadline = "Bidding deadline cannot be in the past";
  }

  if (pickup < now) {
    errors.pickupDate = "Pickup date cannot be in the past";
  }

  if (delivery < now) {
    errors.expectedDeliveryDate = "Delivery date cannot be in the past";
  }

  if (bidding >= pickup) {
    errors.biddingDeadline = "Bidding deadline must be before pickup date";
  }

  if (pickup >= delivery) {
    errors.pickupDate = "Pickup date must be before delivery date";
  }

  if (Object.keys(errors).length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  return {
    isValid: true,
    data: {
      biddingDeadline: bidding,
      pickupDate: pickup,
      expectedDeliveryDate: delivery,
    },
  };
};

export const validateLocation = (location, label = "Location") => {
  const errors = [];

  if (!location || typeof location !== "object") {
    return {
      isValid: false,
      errors: [`${label} is required and must be an object`],
    };
  }

  const { street, city, state, pincode } = location;

  if (!street || typeof street !== "string" || !street.trim()) {
    errors.push(`${label} street is required`);
  }

  if (!city || typeof city !== "string" || !city.trim()) {
    errors.push(`${label} city is required`);
  }

  if (!state || typeof state !== "string" || !state.trim()) {
    errors.push(`${label} state is required`);
  }

  if (
    !pincode ||
    !/^[1-9][0-9]{5}$/.test(String(pincode))
  ) {
    errors.push(`${label} pincode must be a valid 6-digit number`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      street: street?.trim(),
      city: city?.trim(),
      state: state?.trim(),
      pincode: String(pincode),
    },
  };
};
