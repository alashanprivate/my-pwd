use argon2::{Argon2, PasswordHasher, PasswordVerifier};
use argon2::password_hash::SaltString;
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Nonce,
};
use zeroize::ZeroizeOnDrop;

const MASTER_KEY_SIZE: usize = 32;
const NONCE_SIZE: usize = 12;

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
        let mut key = [0u8; MASTER_KEY_SIZE];
        use rand::RngCore;
        let mut rng = rand::thread_rng();
        rng.fill_bytes(&mut key);
        MasterKey(key)
    }
}

pub fn encrypt_data(key: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, String> {
    if key.len() != MASTER_KEY_SIZE {
        return Err("Invalid key size".to_string());
    }

    let cipher = ChaCha20Poly1305::new_from_slice(key).map_err(|e| format!("Cipher error: {}", e))?;

    let mut nonce_bytes = [0u8; NONCE_SIZE];
    use rand::RngCore;
    let mut rng = rand::thread_rng();
    rng.fill_bytes(&mut nonce_bytes);

    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
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

    cipher
        .decrypt(nonce, encrypted)
        .map_err(|e| format!("Decryption error: {}", e))
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
}
