# Development Guide

This document provides detailed instructions for building and developing the My Password Manager application.

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **Rust Toolchain**
   - Download from: https://www.rust-lang.org/tools/install
   - Verify installation: `cargo --version`
   - Verify rustc: `rustc --version`

3. **Tauri CLI**
   ```bash
   cargo install tauri-cli
   # or
   npm install -g @tauri-apps/cli
   ```

4. **Git** (for cloning the repository)
   - Download from: https://git-scm.com/

### Optional Tools

- **VS Code** with the following extensions:
  - Rust Analyzer
  - Tauri
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd my-pwd
```

### 2. Install Frontend Dependencies

```bash
npm install
```

This will install all Node.js dependencies defined in `package.json`.

### 3. Build Rust Dependencies

```bash
cd src-tauri
cargo build
cd ..
```

## Development

### Running in Development Mode

To start the application in development mode with hot-reload:

```bash
npm run tauri dev
```

Or using Tauri CLI directly:

```bash
tauri dev
```

This will:
1. Start the Vite development server (React frontend)
2. Compile the Rust backend in debug mode
3. Launch the Tauri application window
4. Enable hot-reload for both frontend and backend changes

### Development Workflow

**Frontend Development:**
- Edit files in `src/` directory
- Changes are automatically hot-reloaded by Vite
- React components can be modified without restarting the app

**Backend Development:**
- Edit files in `src-tauri/src/` directory
- Changes require a rebuild (automatic in dev mode)
- Tauri will detect changes and recompile

### Common Development Tasks

#### Adding a New Tauri Command

1. **Define the command in `src-tauri/src/main.rs`:**

```rust
#[tauri::command]
async fn my_new_command(param: String) -> Result<String, String> {
    // Your logic here
    Ok("Result".to_string())
}
```

2. **Register the command in the invoke_handler:**

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    my_new_command,
])
```

3. **Call from frontend:**

```typescript
import { invoke } from '@tauri-apps/api/tauri';

const result = await invoke<string>('my_new_command', { param: 'value' });
```

#### Adding a New React Component

1. Create the component file: `src/components/MyComponent.tsx`
2. Import and use it in your parent component:

```typescript
import MyComponent from './MyComponent';

function ParentComponent() {
  return (
    <div>
      <MyComponent />
    </div>
  );
}
```

#### Adding Database Table

1. Add to `storage.rs` in `init_database`:

```rust
conn.execute(
    "CREATE TABLE IF NOT EXISTS my_table (
        id TEXT PRIMARY KEY,
        field1 TEXT NOT NULL,
        field2 INTEGER,
        created_at INTEGER NOT NULL
    )",
    []
).map_err(|e| format!("Failed to create table: {}", e))?;
```

2. Create API functions in appropriate module file (`*_api.rs`)

## Building for Production

### Build Executables

```bash
npm run tauri build
```

Or:

```bash
tauri build
```

This will:
1. Build the React frontend for production
2. Compile the Rust backend in release mode
3. Bundle everything into platform-specific executables

### Output Location

Built executables are located in:
- **Windows**: `src-tauri/target/release/bundle/nsis/`
- **macOS**: `src-tauri/target/release/bundle/dmg/`
- **Linux**: `src-tauri/target/release/bundle/appimage/`

### Build Options

Build for specific platforms:

```bash
# Windows
cargo tauri build --target x86_64-pc-windows-msvc

# macOS
cargo tauri build --target x86_64-apple-darwin
cargo tauri build --target aarch64-apple-darwin

# Linux
cargo tauri build --target x86_64-unknown-linux-gnu
```

## Project Structure

```
my-pwd/
├── src/                          # React Frontend
│   ├── components/               # React Components
│   │   ├── AllPasswords.tsx
│   │   ├── CategoryView.tsx
│   │   ├── EntryModal.tsx
│   │   ├── ForgotPasswordFlow.tsx
│   │   ├── MainLayout.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── VaultLockScreen.tsx
│   │   └── VaultSetup.tsx
│   ├── store/                    # Zustand State Management
│   │   └── useStore.ts
│   ├── App.tsx                   # Main App Component
│   ├── main.tsx                  # Entry Point
│   ├── index.css                 # Global Styles
│   └── vite.config.ts            # Vite Configuration
├── src-tauri/                    # Rust Backend
│   ├── src/
│   │   ├── main.rs               # Tauri Entry Point
│   │   ├── crypto.rs             # Encryption Module
│   │   ├── storage.rs            # Database Operations
│   │   ├── vault.rs              # Vault Management
│   │   ├── entry_api.rs          # Entry CRUD Operations
│   │   ├── category_api.rs       # Category CRUD Operations
│   │   ├── settings_api.rs       # Import/Export Operations
│   │   └── types.rs              # Type Definitions
│   ├── Cargo.toml                # Rust Dependencies
│   ├── tauri.conf.json           # Tauri Configuration
│   ├── icons/                    # Application Icons
│   └── target/                   # Build Output
├── package.json                  # Node Dependencies
├── tsconfig.json                # TypeScript Configuration
├── tailwind.config.js           # TailwindCSS Configuration
├── vite.config.ts               # Vite Configuration
├── README.md                    # Documentation
└── DEVELOPMENT.md               # This File
```

## Key Technologies

### Frontend Stack
- **React 18**: UI library
- **TypeScript**: Type-safe JavaScript
- **Vite**: Build tool and dev server
- **TailwindCSS**: Utility-first CSS framework
- **Zustand**: Lightweight state management
- **Lucide React**: Icon library

### Backend Stack
- **Rust**: Systems programming language
- **Tauri**: Cross-platform desktop framework
- **rusqlite**: SQLite bindings for Rust
- **Tokio**: Async runtime
- **Serde**: Serialization framework

### Cryptography
- **Argon2**: Password hashing (Argon2id variant)
- **ChaCha20-Poly1305**: AEAD encryption
- **Zeroize**: Secure memory clearing

## Testing

### Frontend Testing

```bash
# Run tests (when configured)
npm test
```

### Backend Testing

```bash
# Run unit tests
cd src-tauri
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_name
```

## Debugging

### Frontend Debugging

1. Open browser DevTools in the app window
2. Right-click anywhere in the app window
3. Select "Inspect Element"
4. Use Chrome DevTools for debugging

### Backend Debugging

1. Check the terminal where `tauri dev` is running
2. Rust panics and errors are logged here
3. Use `eprintln!` for debug output
4. Use `cargo build` for better error messages

### Common Issues

**Issue: "Vault not unlocked"**
- Make sure you've called `unlock_vault` before other operations
- Check that the password is correct

**Issue: Database lock**
- Close all app instances
- Delete `.db-shm` and `.db-wal` files
- Restart the app

**Issue: Build fails on Windows**
- Install Visual Studio Build Tools
- Run `rustup update`
- Clean build cache: `cargo clean`

## Performance Optimization

### Frontend
- Use React.memo for expensive components
- Implement virtual scrolling for large lists
- Lazy load components with React.lazy

### Backend
- Use indexes on frequently queried columns
- Batch database operations
- Cache frequently accessed data
- Use async/await for I/O operations

## Security Best Practices

1. **Never commit sensitive data** to version control
2. **Use environment variables** for configuration
3. **Validate all inputs** on both frontend and backend
4. **Use prepared statements** for all SQL queries
5. **Zeroize sensitive data** after use
6. **Regularly update dependencies**

## Contributing

### Code Style

- **Frontend**: Follow ESLint and Prettier rules
- **Backend**: Use `cargo fmt` for formatting
- **Comments**: Document complex logic
- **Type Safety**: Leverage TypeScript and Rust's type system

### Commit Messages

Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Example:
```
feat: add password generator button to entry modal
fix: resolve vault unlock issue on Windows
docs: update README with new features
```

## Deployment

### Windows Distribution

```bash
npm run tauri build
```

The NSIS installer will be in:
`src-tauri/target/release/bundle/nsis/My Password Manager_0.1.0_x64_en-US.msi`

### Code Signing (Optional)

For Windows code signing, update `tauri.conf.json`:

```json
{
  "tauri": {
    "bundle": {
      "windows": {
        "certificateThumbprint": "YOUR_CERTIFICATE_THUMBPRINT",
        "digestAlgorithm": "sha256",
        "timestampUrl": "http://timestamp.digicert.com"
      }
    }
  }
}
```

## Additional Resources

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [React Documentation](https://react.dev/)
- [Rust Book](https://doc.rust-lang.org/book/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [ChaCha20-Poly1305](https://docs.rs/chacha20poly1305/)
- [Argon2](https://docs.rs/argon2/)

## Support

For issues or questions:
1. Check the [README.md](README.md) for usage instructions
2. Review existing issues in the repository
3. Create a new issue with detailed information

---

Happy Coding! 🚀
