# StegoPass

**StegoPass** is a secure web-based tool that hides passwords inside images using a combination of **DWT (Discrete Wavelet Transform)** and **AES encryption**. You can encode and decode passwords in your browser without sending any data to a server.

> **Security Note:** All processing is done on your device. Your passwords and encryption keys never leave your browser.

---

## Features

- AES encryption for password security  
- DWT-based steganography for image encoding  
- Runs entirely in the browser with a modern UI  

---

## Based On

This project is a modification of [woksan/dct-dwt-steganography](https://github.com/woksan/dct-dwt-steganography), extended to include **AES encryption** for enhanced password protection and browser-based functionality.

---

## Demo

Live demo: [StegoPass](https://aron-dxd.github.io/StegoPass/)

---

## Usage

### Run Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/aron-dxd/StegoPass.git
   cd StegoPass
   ```

2. **Open the app**

   Open the `index.html` file directly in your browser or use a local HTTP server.
