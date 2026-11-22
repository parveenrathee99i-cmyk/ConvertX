const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const fileInfo = document.getElementById("fileInfo");
const formatSelect = document.getElementById("format");
const qualityInput = document.getElementById("quality");
const qualityValue = document.getElementById("qualityValue");
const widthInput = document.getElementById("widthInput");
const heightInput = document.getElementById("heightInput");
const aspectLock = document.getElementById("aspectLock");
const convertBtn = document.getElementById("convertBtn");
const clearBtn = document.getElementById("clearBtn");
const resultDiv = document.getElementById("result");
const themeToggle = document.getElementById("themeToggle");
const toolCards = document.querySelectorAll(".tool-card");

let selectedFiles = [];
let originalAspectRatio = 1;

// 1. Dark / Light Mode Toggle (Saved in LocalStorage)
if (localStorage.getItem("convertx-theme") === "dark") {
  document.body.classList.add("dark-mode");
  themeToggle.textContent = "☀️";
}

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  themeToggle.textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("convertx-theme", isDark ? "dark" : "light");
});

// 2. Quality Slider Live Update
qualityInput.addEventListener("input", () => {
  qualityValue.textContent = `${qualityInput.value}%`;
});

// 3. Format Change Warning for PNG (PNG is lossless)
formatSelect.addEventListener("change", () => {
  if (formatSelect.value === "image/png") {
    qualityValue.textContent = `${qualityInput.value}% (Lossless PNG)`;
  } else {
    qualityValue.textContent = `${qualityInput.value}%`;
  }
});

// 4. Aspect Ratio Lock Calculation
widthInput.addEventListener("input", () => {
  if (aspectLock.checked && widthInput.value && originalAspectRatio) {
    heightInput.value = Math.round(widthInput.value / originalAspectRatio);
  }
});

heightInput.addEventListener("input", () => {
  if (aspectLock.checked && heightInput.value && originalAspectRatio) {
    widthInput.value = Math.round(heightInput.value * originalAspectRatio);
  }
});

// 5. File Selection & Drag-and-Drop
fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function handleFiles(files) {
  const validFiles = Array.from(files).filter((file) =>
    ["image/png", "image/jpeg", "image/webp"].includes(file.type)
  );

  if (validFiles.length === 0) {
    fileInfo.innerHTML = `<p style="color:#ef4444;">Please select valid PNG, JPG, or WebP images.</p>`;
    return;
  }

  selectedFiles = validFiles;
  clearBtn.style.display = "inline-block";
  resultDiv.innerHTML = "";

  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
  fileInfo.innerHTML = `<p><strong>${selectedFiles.length} image(s) selected</strong> (Total: ${formatBytes(totalSize)})</p>`;

  // Read first image dimensions to set aspect ratio
  const firstImg = new Image();
  firstImg.onload = () => {
    originalAspectRatio = firstImg.width / firstImg.height;
    widthInput.placeholder = `Width (${firstImg.width}px)`;
    heightInput.placeholder = `Height (${firstImg.height}px)`;
  };
  firstImg.src = URL.createObjectURL(selectedFiles[0]);
}

// Clear Button
clearBtn.addEventListener("click", () => {
  selectedFiles = [];
  fileInput.value = "";
  fileInfo.innerHTML = "";
  resultDiv.innerHTML = "";
  widthInput.value = "";
  heightInput.value = "";
  clearBtn.style.display = "none";
});

// 6. Clickable Popular Tool Cards
toolCards.forEach((card) => {
  card.addEventListener("click", () => {
    const targetFormat = card.getAttribute("data-format");
    const targetQuality = card.getAttribute("data-quality");

    if (targetFormat) formatSelect.value = targetFormat;
    if (targetQuality) {
      qualityInput.value = targetQuality;
      qualityValue.textContent = `${targetQuality}%`;
    }

    document.getElementById("converter").scrollIntoView({ behavior: "smooth" });
  });
});

// 7. Convert Single Image Helper
function convertSingleImage(file, format, quality, customW, customH) {
  return new Promise((resolve) => {
    const originalUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const targetWidth = customW ? parseInt(customW, 10) : img.width;
      const targetHeight = customH ? parseInt(customH, 10) : img.height;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      // Fill white background if converting transparent PNG to JPG
      if (format === "image/jpeg") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (blob) => {
          const ext = format.split("/")[1] === "jpeg" ? "jpg" : format.split("/")[1];
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const newFileName = `${baseName}_ConvertX.${ext}`;
          const convertedUrl = URL.createObjectURL(blob);

          resolve({
            originalName: file.name,
            newFileName,
            originalSize: file.size,
            newSize: blob.size,
            originalUrl,
            convertedUrl,
            blob,
            dimensions: `${targetWidth}×${targetHeight}`
          });
        },
        format,
        quality
      );
    };

    img.src = originalUrl;
  });
}

// 8. Convert All & Batch ZIP Generation
convertBtn.addEventListener("click", async () => {
  if (selectedFiles.length === 0) {
    alert("Please select at least one image first!");
    return;
  }

  convertBtn.disabled = true;
  convertBtn.textContent = "Converting...";
  resultDiv.innerHTML = "";

  const format = formatSelect.value;
  const quality = parseInt(qualityInput.value, 10) / 100;
  const customW = widthInput.value;
  const customH = heightInput.value;

  const convertedItems = [];

  for (const file of selectedFiles) {
    const item = await convertSingleImage(file, format, quality, customW, customH);
    convertedItems.push(item);

    // Calculate compression percentage
    const diffPercent = Math.round(((item.originalSize - item.newSize) / item.originalSize) * 100);
    const badgeClass = diffPercent >= 0 ? "size-badge" : "size-badge larger";
    const badgeText =
      diffPercent >= 0
        ? `Saved ${diffPercent}% (${formatBytes(item.originalSize)} → ${formatBytes(item.newSize)})`
        : `+${Math.abs(diffPercent)}% (${formatBytes(item.originalSize)} → ${formatBytes(item.newSize)})`;

    // Render Before/After Preview Card
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <div class="preview-pair">
        <div class="preview-box">
          <img src="${item.originalUrl}" alt="Original">
          <span>Before (${formatBytes(item.originalSize)})</span>
        </div>
        <div class="preview-box">
          <img src="${item.convertedUrl}" alt="Converted">
          <span>After (${item.dimensions})</span>
        </div>
      </div>
      <div style="font-size:0.85rem; font-weight:600; word-break:break-all;">${item.newFileName}</div>
      <div class="${badgeClass}">${badgeText}</div>
      <br>
      <a href="${item.convertedUrl}" download="${item.newFileName}" class="download-link">Download Image</a>
    `;
    resultDiv.appendChild(card);
  }

  // If multiple files, add "Download All as ZIP" banner
  if (convertedItems.length > 1 && typeof JSZip !== "undefined") {
    const zipBanner = document.createElement("div");
    zipBanner.className = "zip-banner";
    zipBanner.innerHTML = `
      <p style="margin:0 0 8px 0; font-weight:600;">All ${convertedItems.length} images are ready!</p>
      <button id="downloadZipBtn" class="zip-btn">Download All as ZIP</button>
    `;
    resultDiv.prepend(zipBanner);

    document.getElementById("downloadZipBtn").addEventListener("click", async () => {
      const zip = new JSZip();
      convertedItems.forEach((item) => {
        zip.file(item.newFileName, item.blob);
      });
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = zipUrl;
      a.download = "ConvertX_Images.zip";
      a.click();
    });
  }

  convertBtn.disabled = false;
  convertBtn.textContent = "Convert All Now";
});
