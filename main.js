"use strict";

import * as rs from "./reedSolomon.js";
import { dctApply, idctApply } from "./dct.js";
import { dwtApply, idwtApply } from "./dwt.js";
import { cyrb128, sfc32 } from "./rand.js";
import { encryptMessage, decryptMessage } from "./aes.js";

function RS(messageLength, errorCorrectionLength) {
  var dataLength = messageLength - errorCorrectionLength;
  var encoder = new rs.ReedSolomonEncoder(rs.GenericGF.AZTEC_DATA_8());
  var decoder = new rs.ReedSolomonDecoder(rs.GenericGF.AZTEC_DATA_8());
  return {
    dataLength: dataLength,
    messageLength: messageLength,
    errorCorrectionLength: errorCorrectionLength,

    encode: function (message) {
      encoder.encode(message, errorCorrectionLength);
    },

    decode: function (message) {
      decoder.decode(message, errorCorrectionLength);
    }
  };
}

// DOM elements for encoding
const infoEncode = document.getElementById("info-encode");
const previewEncode = document.getElementById("preview-encode");
const textEncode = document.getElementById("text-encode");
const keyEncode = document.getElementById("key-encode");
const toggleKeyEncode = document.getElementById("toggle-key-encode");
const imageUploadEncode = document.getElementById("source-encode");
const textCountEncode = document.getElementById("count-encode");
const encodeButton = document.getElementById("encode-button");
const downloadButton = document.getElementById("download-button");
const fileDropArea = document.getElementById("file-drop-area");

// DOM elements for decoding
const infoDecode = document.getElementById("info-decode");
const previewDecode = document.getElementById("preview-decode");
const keyDecode = document.getElementById("key-decode");
const toggleKeyDecode = document.getElementById("toggle-key-decode");
const imageUploadDecode = document.getElementById("source-decode");
const decodeButton = document.getElementById("decode-button");
const output = document.getElementById("output");
const copyPassword = document.getElementById("copy-password");

// Common elements
const buffer = document.getElementById("buffer");
const display = document.getElementById("display");
const ctx = buffer.getContext("2d");

// Tab functionality
const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    const tabName = button.getAttribute("data-tab");

    // Update active state of buttons
    tabButtons.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");

    // Show the selected tab content
    tabContents.forEach(content => {
      content.classList.remove("active");
      if (content.id === `${tabName}-tab`) {
        content.classList.add("active");
      }
    });
  });
});

const mainSize = 512;
const ec = RS(32, 16);
const maxLength = Math.pow(mainSize / 2 / 4, 2) / 8;
const contentLength = Math.floor(maxLength * ec.dataLength / ec.messageLength);
const INTENSITY = 16; // Fixed optimal intensity

textEncode.maxLength = contentLength;
textCountEncode.innerHTML = `${textEncode.value.length}/${contentLength} characters`;

// Toggle password visibility
toggleKeyEncode.addEventListener("click", () => {
  const type = keyEncode.getAttribute("type") === "password" ? "text" : "password";
  keyEncode.setAttribute("type", type);
  toggleKeyEncode.innerHTML = type === "password" ?
    '<i class="fas fa-eye"></i>' :
    '<i class="fas fa-eye-slash"></i>';
});

toggleKeyDecode.addEventListener("click", () => {
  const type = keyDecode.getAttribute("type") === "password" ? "text" : "password";
  keyDecode.setAttribute("type", type);
  toggleKeyDecode.innerHTML = type === "password" ?
    '<i class="fas fa-eye"></i>' :
    '<i class="fas fa-eye-slash"></i>';
});

// Copy password functionality
copyPassword.addEventListener("click", () => {
  const passwordText = output.textContent;
  if (passwordText) {
    navigator.clipboard.writeText(passwordText)
      .then(() => {
        copyPassword.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
          copyPassword.innerHTML = '<i class="fas fa-copy"></i> Copy';
        }, 2000);
      })
      .catch(err => {
        console.error('Could not copy text: ', err);
      });
  }
});

function encodeImage(image) {
  const message = textEncode.value;
  const key = keyEncode.value;

  if (!message || !key) {
    showToast("Please enter both a password and encryption key", "error");
    return;
  }

  // Encrypt the message first
  const encryptedMessage = encryptMessage(message, key);
  if (!encryptedMessage) {
    showToast("Encryption failed. Please try again.", "error");
    return;
  }

  const binaryString = convertBinary(encryptedMessage);

  const [size, width, height] = getPo2Size(image.width, image.height);

  buffer.width = width;
  buffer.height = height;
  ctx.drawImage(image, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, size, size);
  const dataArray = new Float32Array(size * size);
  convertYCbCr(imageData, dataArray);
  recursiveEncode(dataArray, size, mainSize, binaryString);
  convertRGB(imageData, dataArray);
  ctx.putImageData(imageData, 0, 0);

  display.src = buffer.toDataURL();
  display.style.display = "block";

  downloadButton.disabled = false;
  showToast("Password successfully encoded in image!", "success");
}

function decodeImage(image) {
  const key = keyDecode.value;

  if (!key) {
    showToast("Please enter a decryption key", "error");
    return;
  }

  const [size, width, height] = getPo2Size(image.width, image.height);

  buffer.width = width;
  buffer.height = height;
  ctx.drawImage(image, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, size, size);
  const dataArray = new Float32Array(size * size);
  convertYCbCr(imageData, dataArray);
  const decodedMessage = recursiveDecode(dataArray, size, mainSize);
  const binaryString = decodedMessage.join("");
  const encryptedMessage = convertASCII(binaryString);

  // Decrypt the message
  const decryptedMessage = decryptMessage(encryptedMessage, key);

  if (!decryptedMessage) {
    output.textContent = "Decryption failed. Please check your key and try again.";
    showToast("Decryption failed. Check your key.", "error");
  } else {
    output.textContent = decryptedMessage;
    // Copy to clipboard
    navigator.clipboard.writeText(decryptedMessage)
      .then(() => {
        showToast("Password retrieved and copied to clipboard!", "success");
      })
      .catch(err => {
        console.error("Clipboard write failed:", err);
        showToast("Password retrieved, but copy failed.", "error");
      });
  }
}

// Toast notification function
function showToast(message, type = "info") {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    toastContainer.style.position = "fixed";
    toastContainer.style.bottom = "20px";
    toastContainer.style.right = "20px";
    toastContainer.style.zIndex = "9999";
    document.body.appendChild(toastContainer);
  }

  // Create toast
  const toast = document.createElement("div");
  toast.style.minWidth = "250px";
  toast.style.margin = "10px";
  toast.style.padding = "15px";
  toast.style.borderRadius = "var(--radius)";
  toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
  toast.style.display = "flex";
  toast.style.alignItems = "center";
  toast.style.animation = "fadeIn 0.5s, fadeOut 0.5s 2.5s forwards";
  toast.style.overflow = "hidden";

  // Set color based on type
  if (type === "success") {
    toast.style.backgroundColor = "hsl(142.1 76.2% 36.3%)";
    toast.innerHTML = `<i class="fas fa-check-circle" style="margin-right:10px;"></i> ${message}`;
  } else if (type === "error") {
    toast.style.backgroundColor = "hsl(0 84.2% 60.2%)";
    toast.innerHTML = `<i class="fas fa-exclamation-circle" style="margin-right:10px;"></i> ${message}`;
  } else {
    toast.style.backgroundColor = "hsl(217.2 91.2% 59.8%)";
    toast.innerHTML = `<i class="fas fa-info-circle" style="margin-right:10px;"></i> ${message}`;
  }

  // Add to container
  toastContainer.appendChild(toast);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function recursiveEncode(dataArray, currentSize, desiredSize, binaryString) {
  if (currentSize != desiredSize) {
    const [LL, LH, HL, HH] = dwtApply(dataArray, currentSize);
    recursiveEncode(LL, currentSize / 2, desiredSize, binaryString);
    idwtApply(dataArray, currentSize, LL, LH, HL, HH);
  } else {
    const [LL, LH, HL, HH] = dwtApply(dataArray, currentSize);
    imageEncode(HH, currentSize / 2, binaryString);
    idwtApply(dataArray, currentSize, LL, LH, HL, HH);
  }
}

function recursiveDecode(dataArray, currentSize, desiredSize) {
  if (currentSize != desiredSize) {
    const [LL, LH, HL, HH] = dwtApply(dataArray, currentSize);
    return recursiveDecode(LL, currentSize / 2, desiredSize);
  } else {
    const [LL, LH, HL, HH] = dwtApply(dataArray, currentSize);
    return imageDecode(HH, currentSize / 2);
  }
}

function convertBinary(message) {
    // 1. UTF‑8 encode into bytes
    const encoder = new TextEncoder();
    const rawBytes = encoder.encode(message);

    // 2. Pad/truncate to fit content slots
    const contentArray = new Uint8Array(contentLength);
    contentArray.set(rawBytes.subarray(0, contentLength));

    const bufferArray = new Uint8Array(ec.messageLength);
    const intArray    = new Uint8Array(maxLength);
    const blocks      = Math.floor(maxLength / ec.messageLength);

    // 3. RS‑encode block by block
    for (let i = 0; i < blocks; i++) {
      bufferArray.fill(0);
      bufferArray.set(
        contentArray.subarray(i * ec.dataLength, i * ec.dataLength + ec.dataLength)
      );
      encoder; ec.encode(bufferArray);
      for (let j = 0; j < ec.messageLength; j++) {
        intArray[i * ec.messageLength + j] = bufferArray[j];
      }
    }

    // 4. Turn every byte into 8 bits
    return Array.from(intArray)
      .map(byte => byte.toString(2).padStart(8, "0"))
      .join("");
  }

  function convertASCII(bitString) {
    // 1. Reassemble bytes from bits
    const totalBytes = bitString.length / 8;
    const byteArray  = new Uint8Array(totalBytes);
    for (let i = 0; i < totalBytes; i++) {
      byteArray[i] = parseInt(bitString.substr(i * 8, 8), 2);
    }

    const bufferArray  = new Uint8Array(ec.messageLength);
    const decodedBytes = [];

    // 2. RS‑decode each block
    const blocks = Math.floor(totalBytes / ec.messageLength);
    for (let i = 0; i < blocks; i++) {
      bufferArray.set(
        byteArray.subarray(i * ec.messageLength, i * ec.messageLength + ec.messageLength)
      );
      try {
        ec.decode(bufferArray);
      } catch (e) {
        console.warn("RS decode failed on block", i, e);
      }
      // collect only the data bytes
      decodedBytes.push(...bufferArray.subarray(0, ec.dataLength));
    }

    // 3. Trim trailing zeros and UTF‑8 decode
    const trimmed = new Uint8Array(decodedBytes).filter(b => b !== 0);
    const decoder = new TextDecoder();
    return decoder.decode(trimmed);
  }

function convertYCbCr(imageData, dataArray) {
  for (let i = 0; i < dataArray.length; i++) {
    const R = imageData.data[i * 4 + 0];
    const G = imageData.data[i * 4 + 1]
    const B = imageData.data[i * 4 + 2];
    dataArray[i] = 0.299 * R + 0.587 * G + 0.114 * B;
  }
}

function convertRGB(imageData, dataArray) {
  for (let i = 0; i < dataArray.length; i++) {
    const R = imageData.data[i * 4 + 0];
    const G = imageData.data[i * 4 + 1]
    const B = imageData.data[i * 4 + 2];

    const Y = dataArray[i];
    const Cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B;
    const Cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B;

    const nR = Y + 1.402 * (Cr - 128);
    const nG = Y - 0.344136 * (Cb - 128) - 0.714136 * (Cr - 128);
    const nB = Y + 1.772 * (Cb - 128);

    imageData.data[i * 4 + 0] = Math.round(nR);
    imageData.data[i * 4 + 1] = Math.round(nG);
    imageData.data[i * 4 + 2] = Math.round(nB);
  }
}

function imageEncode(dataArray, size, binaryString) {
  // Use encryption key for both patterns instead of seed
  const key = keyEncode.value;
  const S_0 = cyrb128(key + "0");
  const S_1 = cyrb128(key + "1");

  const P_0 = sfc32(S_0[0], S_0[1], S_0[2], S_0[3]);
  const P_1 = sfc32(S_1[0], S_1[1], S_1[2], S_1[3]);

  let offset = 0;

  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {
      const noiseVectorSelect = {
        "0": nextNoiseVector(P_0),
        "1": nextNoiseVector(P_1)
      };

      const bit = binaryString[offset++];

      dctEncode(dataArray, size, x, y, noiseVectorSelect[bit]);
    }
  }
}

function imageDecode(dataArray, size) {
    // Use decryption key for both patterns instead of seed
    const key = keyDecode.value;
    const S_0 = cyrb128(key + "0");
    const S_1 = cyrb128(key + "1");

    const P_0 = sfc32(S_0[0], S_0[1], S_0[2], S_0[3]);
    const P_1 = sfc32(S_1[0], S_1[1], S_1[2], S_1[3]);

    const bitArray = [];

    for (let y = 0; y < size; y += 4) {
      for (let x = 0; x < size; x += 4) {
        const noiseVector0 = nextNoiseVector(P_0);
        const noiseVector1 = nextNoiseVector(P_1);

        const bit = dctDecode(dataArray, size, x, y, noiseVector0, noiseVector1);
        bitArray.push(bit);
      }
    }

    return bitArray;
  }

  function dctDecode(dataArray, size, x, y, noiseVector0, noiseVector1) {
    const dctSquare = new Float32Array(4 * 4);
    readData(dctSquare, size, dataArray, x, y);
    dctApply(dctSquare);

    const dataVector = readDataVector(dctSquare);

    const r0 = pearsonCorrelation(dataVector, noiseVector0);
    const r1 = pearsonCorrelation(dataVector, noiseVector1);

    return r0 < r1 ? 1 : 0;
  }

  function readDataVector(dataArray) {
    const dataVector = new Float32Array(10);

    let N = 0;

    for (let i = 2; i < 4; i++) {
      for (let j = 0; j < i + 1; j++) {
        const x = i - j;
        const y = j;
        dataVector[N] = dataArray[y * 4 + x];
        N++;
      }
    }

    for (let j = 0; j < 3; j++) {
      const x = 3 - j;
      const y = 1 + j;
      dataVector[N] = dataArray[y * 4 + x];
      N++;
    }

    return dataVector;
  }

  function noiseApply(outputArray, noiseVector) {
    let N = 0;

    for (let i = 2; i < 4; i++) {
      for (let j = 0; j < i + 1; j++) {
        const x = i - j;
        const y = j;
        outputArray[y * 4 + x] += noiseVector[N++];
      }
    }

    for (let j = 0; j < 3; j++) {
      const x = 3 - j;
      const y = 1 + j;
      outputArray[y * 4 + x] += noiseVector[N++];
    }
  }

  function pearsonCorrelation(X, Y) {
    const N = X.length;

    let x_bar = 0.0;
    let y_bar = 0.0;

    for (let i = 0; i < N; i++) {
      x_bar += X[i];
      y_bar += Y[i];
    }

    x_bar /= N;
    y_bar /= N;

    let sumDiffProd = 0.0;
    let sumSquareDiffX = 0.0;
    let sumSquareDiffY = 0.0;

    for (let i = 0; i < N; i++) {
      sumDiffProd += (X[i] - x_bar) * (Y[i] - y_bar);
      sumSquareDiffX += Math.pow(X[i] - x_bar, 2);
      sumSquareDiffY += Math.pow(Y[i] - y_bar, 2);
    }

    return sumDiffProd / Math.sqrt(sumSquareDiffX * sumSquareDiffY);
  }

  function nextNoiseVector(noise) {
    const noiseVector = new Float32Array(10);
    for (let i = 0; i < noiseVector.length; i++) {
      noiseVector[i] = (noise() * 2.0 - 1.0) * INTENSITY;
    }
    return noiseVector;
  }

  function dctEncode(dataArray, size, x, y, noiseVector) {
    const dctSquare = new Float32Array(4 * 4);
    readData(dctSquare, size, dataArray, x, y);

    dctApply(dctSquare);
    noiseApply(dctSquare, noiseVector);
    idctApply(dctSquare);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        dataArray[(y + i) * size + (x + j)] = dctSquare[i * 4 + j];
      }
    }
  }

  function readData(outputArray, size, dataArray, x, y) {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        outputArray[i * 4 + j] = dataArray[(y + i) * size + (x + j)];
      }
    }
  }

  function getPo2Size(width, height) {
    if (height < width) {
      const size = Math.max(Math.pow(2, Math.round(Math.log(height)/Math.log(2))), mainSize);
      return [ size, Math.round(size * width / height), size ];
    } else {
      const size = Math.max(Math.pow(2, Math.round(Math.log(width)/Math.log(2))), mainSize);
      return [ size, size, Math.round(size * height / width) ];
    }
  }

  function changeTargetEncode(src) {
    const image = new Image();
    image.src = src;
    image.onload = () => {
      infoEncode.innerHTML = `Image: ${image.width}×${image.height}`;

      const ctxPreview = previewEncode.getContext("2d");
      ctxPreview.clearRect(0, 0, previewEncode.width, previewEncode.height);

      // Calculate aspect ratio for preview
      const aspectRatio = image.width / image.height;
      let drawWidth, drawHeight;

      if (aspectRatio > 1) {
        // Wider than tall
        drawWidth = previewEncode.width;
        drawHeight = previewEncode.width / aspectRatio;
      } else {
        // Taller than wide
        drawHeight = previewEncode.height;
        drawWidth = previewEncode.height * aspectRatio;
      }

      // Center the image
      const offsetX = (previewEncode.width - drawWidth) / 2;
      const offsetY = (previewEncode.height - drawHeight) / 2;

      ctxPreview.fillStyle = "hsl(var(--muted))";
      ctxPreview.fillRect(0, 0, previewEncode.width, previewEncode.height);
      ctxPreview.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

      // Store the image for later use
      previewEncode.dataset.imageSrc = src;
    };
  }

  function changeTargetDecode(src) {
    const image = new Image();
    image.src = src;
    image.onload = () => {
      infoDecode.innerHTML = `Image: ${image.width}×${image.height}`;

      const ctxPreview = previewDecode.getContext("2d");
      ctxPreview.clearRect(0, 0, previewDecode.width, previewDecode.height);

      // Calculate aspect ratio for preview
      const aspectRatio = image.width / image.height;
      let drawWidth, drawHeight;

      if (aspectRatio > 1) {
        // Wider than tall
        drawWidth = previewDecode.width;
        drawHeight = previewDecode.width / aspectRatio;
      } else {
        // Taller than wide
        drawHeight = previewDecode.height;
        drawWidth = previewDecode.height * aspectRatio;
      }

      // Center the image
      const offsetX = (previewDecode.width - drawWidth) / 2;
      const offsetY = (previewDecode.height - drawHeight) / 2;

      ctxPreview.fillStyle = "hsl(var(--muted))";
      ctxPreview.fillRect(0, 0, previewDecode.width, previewDecode.height);
      ctxPreview.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

      // Store the image for later use
      previewDecode.dataset.imageSrc = src;
    };
  }

  // Event listeners for file drop area
  fileDropArea.addEventListener("click", () => {
    imageUploadEncode.click();
  });

  document.getElementById("file-drop-area-decode").addEventListener("click", () => {
    imageUploadDecode.click();
  });

  // Add highlight class when dragging over the drop area
  ["dragenter", "dragover"].forEach(eventName => {
    fileDropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      fileDropArea.classList.add("highlight");
    });

    document.getElementById("file-drop-area-decode").addEventListener(eventName, (e) => {
      e.preventDefault();
      document.getElementById("file-drop-area-decode").classList.add("highlight");
    });
  });

  // Remove highlight class when drag leaves
  ["dragleave", "drop"].forEach(eventName => {
    fileDropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      fileDropArea.classList.remove("highlight");
    });

    document.getElementById("file-drop-area-decode").addEventListener(eventName, (e) => {
      e.preventDefault();
      document.getElementById("file-drop-area-decode").classList.remove("highlight");
    });
  });

  // Event listeners
  imageUploadEncode.addEventListener("change", (e) => {
    if (imageUploadEncode.files && imageUploadEncode.files[0]) {
      changeTargetEncode(URL.createObjectURL(imageUploadEncode.files[0]));
    }
  });

  imageUploadDecode.addEventListener("change", (e) => {
    if (imageUploadDecode.files && imageUploadDecode.files[0]) {
      changeTargetDecode(URL.createObjectURL(imageUploadDecode.files[0]));
    }
  });

  textEncode.addEventListener("input", () => {
    textCountEncode.innerHTML = `${textEncode.value.length}/${contentLength} characters`;
  });

  encodeButton.addEventListener("click", () => {
    if (!previewEncode.dataset.imageSrc) {
      showToast("Please select an image first", "error");
      return;
    }

    const image = new Image();
    image.onload = () => encodeImage(image);
    image.src = previewEncode.dataset.imageSrc;
  });

  decodeButton.addEventListener("click", () => {
    if (!previewDecode.dataset.imageSrc) {
      showToast("Please select an image first", "error");
      return;
    }

    output.textContent = "Decoding...";

    const image = new Image();
    image.onload = () => decodeImage(image);
    image.src = previewDecode.dataset.imageSrc;
  });

  downloadButton.addEventListener("click", () => {
    if (display.src) {
      const a = document.createElement("a");
      a.href = display.src;
      a.download = "secured-password-image.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Image downloaded successfully!", "success");
    } else {
      showToast("Please encode an image first", "error");
    }
  });

  // Handle drag and drop for both tabs
  const dropArea = document.getElementById("drop");

  dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  dropArea.addEventListener("drop", (e) => {
    e.preventDefault();

    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        if (e.dataTransfer.items[i].kind === 'file') {
          const file = e.dataTransfer.items[i].getAsFile();
          if (file.type.startsWith('image/')) {
            const src = URL.createObjectURL(file);

            // Determine which tab is active and change the appropriate preview
            if (document.getElementById("encode-tab").classList.contains("active")) {
              changeTargetEncode(src);
            } else {
              changeTargetDecode(src);
            }
            break;
          }
        }
      }
    }
  });

  // Handle paste events for both tabs
  window.addEventListener("paste", (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        const src = URL.createObjectURL(blob);

        // Determine which tab is active and change the appropriate preview
        if (document.getElementById("encode-tab").classList.contains("active")) {
          changeTargetEncode(src);
        } else {
          changeTargetDecode(src);
        }
        break;
      }
    }
  });

  // Initialize application
  downloadButton.disabled = true;

  // Make dropzone area for decode tab behave similar to encode tab
  const fileDropAreaDecode = document.getElementById("file-drop-area-decode");
  if (fileDropAreaDecode) {
    fileDropAreaDecode.style.border = "2px dashed hsl(var(--border))";
    fileDropAreaDecode.style.borderRadius = "var(--radius)";
    fileDropAreaDecode.style.padding = "2rem 1rem";
    fileDropAreaDecode.style.textAlign = "center";
    fileDropAreaDecode.style.transition = "all 0.2s ease";
    fileDropAreaDecode.style.marginBottom = "1rem";
    fileDropAreaDecode.style.backgroundColor = "hsl(var(--secondary))";
  }
