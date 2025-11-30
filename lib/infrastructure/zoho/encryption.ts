/**
 * @file lib/infrastructure/zoho/encryption.ts
 * @description Module de chiffrement/déchiffrement des tokens Zoho
 * 
 * Utilise AES-256-GCM pour un chiffrement authentifié.
 * Les tokens sont stockés au format : iv:authTag:encryptedData (tout en base64)
 * 
 * IMPORTANT : La clé ENCRYPTION_KEY doit faire exactement 32 caractères (256 bits)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits pour GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Récupère la clé de chiffrement depuis les variables d'environnement
 * @throws Error si la clé n'est pas configurée ou invalide
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY non configurée. ' +
      'Générez une clé avec : openssl rand -base64 32'
    );
  }
  
  // La clé doit faire 32 bytes (256 bits) pour AES-256
  // Si elle est en base64, on la décode
  let keyBuffer: Buffer;
  
  try {
    // Essayer de décoder comme base64
    keyBuffer = Buffer.from(key, 'base64');
    
    // Si le décodage base64 ne donne pas 32 bytes, utiliser directement
    if (keyBuffer.length !== 32) {
      keyBuffer = Buffer.from(key, 'utf-8');
    }
  } catch {
    keyBuffer = Buffer.from(key, 'utf-8');
  }
  
  // Ajuster la taille si nécessaire (padding ou truncation)
  if (keyBuffer.length < 32) {
    // Padding avec des zéros (pas idéal mais évite les erreurs)
    const padded = Buffer.alloc(32);
    keyBuffer.copy(padded);
    keyBuffer = padded;
    console.warn('ENCRYPTION_KEY trop courte, padding appliqué. Utilisez une clé de 32 bytes.');
  } else if (keyBuffer.length > 32) {
    keyBuffer = keyBuffer.subarray(0, 32);
  }
  
  return keyBuffer;
}

/**
 * Chiffre une chaîne de caractères avec AES-256-GCM
 * 
 * @param plaintext - Le texte à chiffrer
 * @returns Le texte chiffré au format "iv:authTag:encryptedData" (base64)
 * @throws Error si le chiffrement échoue
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Impossible de chiffrer une chaîne vide');
  }
  
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  // Format : iv:authTag:encryptedData (tout en base64)
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted,
  ].join(':');
}

/**
 * Déchiffre une chaîne chiffrée avec AES-256-GCM
 * 
 * @param encryptedText - Le texte chiffré au format "iv:authTag:encryptedData"
 * @returns Le texte déchiffré
 * @throws Error si le déchiffrement échoue (clé incorrecte, données corrompues, etc.)
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    throw new Error('Impossible de déchiffrer une chaîne vide');
  }
  
  const parts = encryptedText.split(':');
  
  if (parts.length !== 3) {
    throw new Error(
      'Format de données chiffrées invalide. ' +
      'Attendu : "iv:authTag:encryptedData"'
    );
  }
  
  const [ivBase64, authTagBase64, encryptedData] = parts;
  
  const key = getEncryptionKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  
  if (iv.length !== IV_LENGTH) {
    throw new Error(`IV invalide : attendu ${IV_LENGTH} bytes, reçu ${iv.length}`);
  }
  
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`AuthTag invalide : attendu ${AUTH_TAG_LENGTH} bytes, reçu ${authTag.length}`);
  }
  
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  decipher.setAuthTag(authTag);
  
  try {
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // Erreur d'authentification = données corrompues ou mauvaise clé
    throw new Error(
      'Échec du déchiffrement. ' +
      'Vérifiez que ENCRYPTION_KEY est correcte et que les données ne sont pas corrompues.'
    );
  }
}

/**
 * Vérifie si une chaîne est au format chiffré valide
 * 
 * @param text - Le texte à vérifier
 * @returns true si le format semble valide
 */
export function isEncryptedFormat(text: string): boolean {
  if (!text) return false;
  
  const parts = text.split(':');
  if (parts.length !== 3) return false;
  
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    
    return iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Génère une clé de chiffrement aléatoire (pour documentation/setup)
 * 
 * @returns Une clé de 32 bytes en base64
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('base64');
}
