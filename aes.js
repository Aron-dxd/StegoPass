export function encryptMessage(message, key) {
  if (!message || !key) return '';

  try {
    const encrypted = CryptoJS.AES.encrypt(message, key).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return '';
  }
}

export function decryptMessage(encryptedMessage, key) {
  if (!encryptedMessage || !key) return '';

  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedMessage, key).toString(CryptoJS.enc.Utf8);
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return '';
  }
}
