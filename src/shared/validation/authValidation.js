const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,64}$/;
const SIX_DIGIT_CODE_REGEX = /^\d{6}$/;

export const PASSWORD_RULES_TEXT =
  'Sifre en az 8 karakter olmali; buyuk harf, kucuk harf, rakam ve ozel karakter icermelidir.';

export const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

export const isValidEmail = (value) => EMAIL_REGEX.test(normalizeEmail(value));

export const isStrongPassword = (value) => PASSWORD_REGEX.test(String(value || ''));

export const isSixDigitCode = (value) => SIX_DIGIT_CODE_REGEX.test(String(value || '').trim());

export const validateRegistrationForm = ({ fullName, email, password, confirm }) => {
  const trimmedName = String(fullName || '').trim();
  if (!trimmedName || !email || !password || !confirm) {
    return 'Lutfen tum alanlari doldurun.';
  }
  if (trimmedName.length < 3) {
    return 'Ad soyad en az 3 karakter olmali.';
  }
  if (!isValidEmail(email)) {
    return 'Gecerli bir e-posta giriniz.';
  }
  if (!isStrongPassword(password)) {
    return PASSWORD_RULES_TEXT;
  }
  if (password !== confirm) {
    return 'Sifreler eslesmiyor.';
  }
  return null;
};
