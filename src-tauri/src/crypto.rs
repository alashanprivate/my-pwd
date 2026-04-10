use argon2::{Argon2, PasswordHasher, PasswordVerifier};
use argon2::password_hash::SaltString;
use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload},
    ChaCha20Poly1305, Nonce,
};
use rand::{Rng, SeedableRng};
use zeroize::ZeroizeOnDrop;

const MASTER_KEY_SIZE: usize = 32;
const NONCE_SIZE: usize = 12;
/// AAD（Additional Authenticated Data）上下文标识符
/// 绑定到每次加密操作，确保密文完整性校验包含应用上下文
const AAD_CONTEXT: &[u8] = b"my-pwd-v1";

/// 使用密码学安全的随机数生成器生成 16 字节 ID（hex 编码 32 字符）
/// # Security
/// 使用 StdRng::from_entropy() 从系统 CSPRNG 播种，保证不可预测性。
/// 用于 entry ID、category ID、vault ID 等所有内部标识符。
pub fn generate_secure_id() -> String {
    let mut bytes = [0u8; 16];
    // StdRng::from_entropy() 调用系统级加密随机数（getrandom / /dev/urandom）
    let mut rng = rand::rngs::StdRng::from_entropy();
    rng.fill(&mut bytes);
    hex::encode(bytes)
}

#[derive(ZeroizeOnDrop)]
pub struct MasterKey([u8; MASTER_KEY_SIZE]);

impl MasterKey {
    pub fn derive_from_password(password: &[u8], salt: &SaltString) -> Result<Self, String> {
        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(password, salt)
            .map_err(|e| format!("Failed to hash password: {}", e))?;

        let mut key = [0u8; MASTER_KEY_SIZE];
        key.copy_from_slice(password_hash.hash.unwrap().as_bytes());

        Ok(MasterKey(key))
    }

    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }

    pub fn to_vec(&self) -> Vec<u8> {
        self.0.to_vec()
    }

    pub fn generate_random() -> Self {
        let mut rng = rand::rngs::StdRng::from_entropy();
        let mut key = [0u8; MASTER_KEY_SIZE];
        rng.fill(&mut key);
        MasterKey(key)
    }
}

pub fn encrypt_data(key: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, String> {
    if key.len() != MASTER_KEY_SIZE {
        return Err("Invalid key size".to_string());
    }

    let cipher = ChaCha20Poly1305::new_from_slice(key).map_err(|e| format!("Cipher error: {}", e))?;

    let mut nonce_bytes = [0u8; NONCE_SIZE];
    let mut rng = rand::rngs::StdRng::from_entropy();
    rng.fill(&mut nonce_bytes);

    let nonce = Nonce::from_slice(&nonce_bytes);

    let payload = Payload {
        msg: plaintext,
        aad: AAD_CONTEXT,
    };
    let ciphertext = cipher
        .encrypt(nonce, payload)
        .map_err(|e| format!("Encryption error: {}", e))?;

    // Combine nonce + ciphertext
    let mut result = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);

    Ok(result)
}

pub fn decrypt_data(key: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>, String> {
    if key.len() != MASTER_KEY_SIZE {
        return Err("Invalid key size".to_string());
    }

    if ciphertext.len() < NONCE_SIZE {
        return Err("Ciphertext too short".to_string());
    }

    let cipher = ChaCha20Poly1305::new_from_slice(key).map_err(|e| format!("Cipher error: {}", e))?;

    let (nonce_bytes, encrypted) = ciphertext.split_at(NONCE_SIZE);
    let nonce = Nonce::from_slice(nonce_bytes);

    // 先用 AAD 解密（新格式），失败则回退到空 AAD（兼容旧数据）
    let payload_with_aad = Payload {
        msg: encrypted,
        aad: AAD_CONTEXT,
    };

    match cipher.decrypt(nonce, payload_with_aad) {
        Ok(plaintext) => Ok(plaintext),
        Err(_) => {
            // 向后兼容：旧数据使用空 AAD 加密
            let payload_legacy = Payload {
                msg: encrypted,
                aad: b"",
            };
            cipher
                .decrypt(nonce, payload_legacy)
                .map_err(|e| format!("Decryption error: {}", e))
        }
    }
}

pub fn hash_password(password: &[u8], salt: &SaltString) -> Result<String, String> {
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password, salt)
        .map_err(|e| format!("Failed to hash password: {}", e))?;

    Ok(password_hash.to_string())
}

pub fn verify_password_hash(password_hash: &str, password: &[u8]) -> Result<bool, String> {
    let argon2 = Argon2::default();
    let parsed_hash = argon2::password_hash::PasswordHash::new(password_hash)
        .map_err(|e| format!("Failed to parse password hash: {}", e))?;

    Ok(argon2.verify_password(password, &parsed_hash).is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption() {
        let key = MasterKey::generate_random();
        let plaintext = b"Hello, world!";
        let encrypted = encrypt_data(key.as_bytes(), plaintext).unwrap();
        let decrypted = decrypt_data(key.as_bytes(), &encrypted).unwrap();
        assert_eq!(plaintext, decrypted.as_slice());
    }

    #[test]
    fn test_aad_tamper_detection() {
        let key = MasterKey::generate_random();
        let plaintext = b"sensitive data";
        let mut encrypted = encrypt_data(key.as_bytes(), plaintext).unwrap();
        // 篡改密文中间字节
        let tamper_idx = NONCE_SIZE + 5;
        if tamper_idx < encrypted.len() {
            encrypted[tamper_idx] ^= 0xFF;
        }
        // AAD 绑定的密文被篡改后应解密失败
        assert!(decrypt_data(key.as_bytes(), &encrypted).is_err());
    }

    #[test]
    fn test_legacy_compatibility() {
        // 模拟旧格式：使用空 AAD 加密
        let key = MasterKey::generate_random();
        let plaintext = b"legacy data";

        let cipher = ChaCha20Poly1305::new_from_slice(key.as_bytes()).unwrap();
        let mut nonce_bytes = [0u8; NONCE_SIZE];
        let mut rng = rand::rngs::StdRng::from_entropy();
        rng.fill(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let legacy_payload = Payload {
            msg: plaintext,
            aad: b"",
        };
        let ciphertext = cipher.encrypt(nonce, legacy_payload).unwrap();

        let mut legacy_encrypted = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
        legacy_encrypted.extend_from_slice(&nonce_bytes);
        legacy_encrypted.extend_from_slice(&ciphertext);

        // 新的 decrypt_data 应能解密旧格式数据
        let decrypted = decrypt_data(key.as_bytes(), &legacy_encrypted).unwrap();
        assert_eq!(plaintext, decrypted.as_slice());
    }

    #[test]
    fn test_generate_secure_id_uniqueness() {
        let ids: Vec<String> = (0..1000).map(|_| generate_secure_id()).collect();
        let unique: std::collections::HashSet<_> = ids.iter().collect();
        assert_eq!(ids.len(), unique.len(), "generate_secure_id must produce unique IDs");
    }

    #[test]
    fn test_generate_secure_id_length() {
        let id = generate_secure_id();
        assert_eq!(id.len(), 32, "16 bytes hex-encoded = 32 chars");
    }
}
