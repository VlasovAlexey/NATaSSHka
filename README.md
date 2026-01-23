# NATaSSHka

**NATaSSHka — encrypted messages and calls in your browser**

A secure messenger application with **end-to-end encryption** that supports text messages, voice and video messages, file sharing, and audio/video calls directly in the browser.

---
- [Features](#features)  
- [Similarity to other messengers](#similarity-to-other-messengers)  
- [Advantages and capabilities](#advantages-and-capabilities)  
- [Installation and configuration](#installation-and-configuration)
- [Local launch and testing](#local-launch-and-testing)
- [Encryption and decryption](#encryption-and-decryption)
- [config.json parameters](#configjson-parameters)  
- [License](#license)  

---

## Features
- Sending and receiving **text messages** in real time  
- Recording and sending **voice messages**  
- Recording and sending **video messages**  
- Audio/video calls via WebRTC  
- Sharing any files (with size limits)  
- End-to-end encryption of text and files on the client side  
- Support for rooms (room chats) for private communication  
- Message history: messages are stored per room (on the server, in encrypted form)  
- Ability to delete/clear a chat or all chats (via special codes)  

---

## Similarity to other messengers

By its functionality, NATaSSHka is similar to:

- **Telegram** — secure file transfer, strong focus on privacy  
- **WhatsApp** — voice and video messages, calls, and media sharing  
- **Signal** — strong end-to-end encryption and data protection  

---

## Advantages and capabilities

- **Privacy and security** — data is encrypted on the client side; the server has no access to plaintext messages or files  
- **Encryption key control** — the user defines and holds the key; the server does not store it  
- **No registration** — basic access can be password-based, without complex authentication  
- **Support for multiple media formats** — text, voice, video, files  
- **Flexible configuration** — WebRTC parameters, audio/video quality, file size limits, etc. can be adjusted  
- **Open source** — code can be reviewed, modified, and extended  

---

## Installation and configuration

### Prerequisites

- Node.js version 14 or higher  
- npm (comes with Node.js)  
- Internet access on first launch (if STUN / TURN is used)  
- A browser (Chrome or any modern browser)  

### Installation steps

1. Clone the repository:

   ```bash
   git clone https://github.com/VlasovAlexey/NATaSSHka.git
   cd NATaSSHka
   ```
   or download the repository as a ZIP archive.

2. Install dependencies:

   ```bash
   npm install express
   ```

3. Configure the `config.json` file (optional — defaults can be used or modified).  

4. Start the server:

   ```bash
   node server.js
   ```

   or on Windows using `start_server.bat`.

---

## config.json parameters

`config.json` contains settings that affect application behavior. Field descriptions:

| Parameter | Type | Description |
|---|---|---|
| `port` | number | Port on which the server runs (e.g. 3000) |
| `password` | string | Password required to access the chat / room |
| `stunServers` | array of objects | List of STUN servers for WebRTC (used to establish connections through NAT) |
| `killCode` | string | Code word that clears the chat and deletes files in the **current room** |
| `killAllCode` | string | Code word that clears **all rooms**, files, and may shut down the server (depends on implementation) |
| `maxFileSize` | number | Maximum allowed file size in bytes |
| `audio` | object | Audio recording settings (sampleRate, sampleSize, mimeType, etc.) |
| `rtc_video` | object | Video settings for WebRTC calls (resolution, fps, etc.) |
| `rtc_audio` | object | Audio settings for WebRTC (channels, echo cancellation, noise suppression, etc.) |
| `videoRec_width`, `videoRec_height`, `videoRec_frameRate`, `videoRec_bitrate`, `videoRec_mimeType` | number / string | Parameters for recording video messages: width, height, frame rate, bitrate, MIME type |
| `encryptionDebounceDelay` | number | Delay (in milliseconds) before re-decrypting messages when the encryption key changes (to avoid UI overload) |

---

## Local launch and testing

1. Make sure `config.json` is configured correctly (port, password, STUN servers).  

2. Start the server:

   ```bash
   node server.js
   ```

   or via `start_server.bat` (if available).  

3. Open Chrome and navigate to:

   ```
   http://localhost:<port>
   ```

   Example: if `port` = 3000 → `http://localhost:3000`

4. On first access, the browser will request permission to use the microphone and camera — allow access if you want to use calls.

5. In the interface, enter your username, select a room (e.g. the default “Room_01”), and enter the password (if set in `config.json`).

6. Call testing:

   - Open a second browser window (or incognito mode), log in with a different username, the same room, and the same password.  
   - Verify that voice/video messages are sent correctly, calls connect, files are encrypted and decrypted, and media is displayed properly.

---

## Encryption and decryption

### How it works

- The client defines an encryption key (password/key) — this key is known **only to the client(s)**, not the server.  
- When sending a text message or file, the client encrypts the data using AES via CryptoJS.  
- If a message is marked as encrypted (`isEncrypted` or a similar flag), the server stores and forwards **only encrypted content**, without the ability to read it.  
- Upon receiving a message, the client checks for an encryption key: if present, it attempts decryption. If the key is correct, the original text/file/media is shown; otherwise, an error is displayed (“invalid encryption key”).  
- For files: media (audio, video, images) may use deferred decryption — the file can be downloaded but decrypted only when needed for playback or viewing.

### Benefits of client-side encryption

- The server never sees plaintext data — even if compromised, attackers cannot access message text or file contents.  
- The user controls the key — it can be changed, stored locally, and never transmitted.  
- Increased privacy and security, suitable for confidential communication.  
- Compatible with principles used in Signal, WhatsApp, and Telegram for end-to-end encryption.

---

## License
This project is licensed under the **MIT License**.  
See the [`LICENSE`](LICENSE) file for details.
