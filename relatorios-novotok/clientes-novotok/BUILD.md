# Build Instructions for Clientes NovoTok

## Prerequisites
1. Install Node.js (v14 or higher)
2. Install dependencies: `npm install`

## Available Build Scripts

### Development
- `npm start` - Start the application in development mode

### Production Builds
- `npm run build` - Build for current platform
- `npm run build:win` - Build for Windows (current architecture)
- `npm run build:win32` - Build for Windows 32-bit
- `npm run build:win64` - Build for Windows 64-bit
- `npm run build:all-win` - Build for both Windows 32-bit and 64-bit
- `npm run dist` - Build all Windows versions (shortcut for build:all-win)

## Build Output
Built applications will be available in the `dist/` folder:
- **NSIS Installer**: `Clientes NovoTok Setup 1.0.0.exe` (with architecture suffix)
- **Portable Version**: `Clientes NovoTok-1.0.0-{arch}-portable.exe`

## Build Configuration
- **App ID**: com.novotok.clientes-novotok
- **Product Name**: Clientes NovoTok
- **Icon**: assets/logo.png
- **Target Formats**: NSIS Installer + Portable Executable
- **Architectures**: x64 (64-bit) and ia32 (32-bit)

## Notes
- The application icon is located at `assets/logo.png`
- For optimal Windows compatibility, consider converting the PNG logo to ICO format
- The build excludes backend dependencies and environment files to reduce package size
- Both installer and portable versions are generated for maximum deployment flexibility

## Example Build Commands
```bash
# Install build dependencies
npm install

# Build for Windows 64-bit only
npm run build:win64

# Build for both Windows architectures
npm run dist
```

## File Structure After Build
```
dist/
├── Clientes NovoTok Setup 1.0.0-x64.exe       # 64-bit installer
├── Clientes NovoTok Setup 1.0.0-ia32.exe      # 32-bit installer
├── Clientes NovoTok-1.0.0-x64-portable.exe    # 64-bit portable
└── Clientes NovoTok-1.0.0-ia32-portable.exe   # 32-bit portable
```