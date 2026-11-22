// Setup PDF.js Worker if available
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

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

// 1. Dark / Light Mode Toggle
if (localStorage.getItem("convertx-theme") === "dark") {
  document.body.classList.add("dark-mode");
  if (themeToggle) themeToggle.textContent = "☀️";
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    themeToggle.textContent = isDark ? "☀️" : "🌙";
    localStorage.setItem("convertx-theme", isDark ? "dark" : "light");
  });
}

// 2. Quality & Optional Resizer Controls
if (qualityInput && qualityValue) {
  qualityInput.addEventListener("input", () => {
    qualityValue.textContent = `${qualityInput.value}%`;
  });
}

if (widthInput && heightInput && aspectLock) {
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
}

// 3. File Upload & Drag-and-Drop
if (fileInput) {
  fileInput.addEventListener("change", (e) => handleFiles(e.target.files));
}

if (dropZone) {
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
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function handleFiles(files) {
  const validFiles = Array.from(files);
  if (validFiles.length === 0) return;

  selectedFiles = validFiles;
  if (clearBtn) clearBtn.style.display = "inline-block";
  resultDiv.innerHTML = "";

  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
  fileInfo.innerHTML = `<p><strong>${selectedFiles.length} file(s) selected</strong> (Total: ${formatBytes(totalSize)})</p>`;

  const firstFile = selectedFiles[0];
  if (firstFile.type.startsWith("image/")) {
    const img = new Image();
    img.onload = () => {
      originalAspectRatio = img.width / img.height;
      if (widthInput) widthInput.placeholder = `Width (${img.width}px)`;
      if (heightInput) heightInput.placeholder = `Height (${img.height}px)`;
    };
    img.src = URL.createObjectURL(firstFile);

    // On Converter page, auto-select PDF if multiple images are uploaded
    if (!widthInput && selectedFiles.length > 1) {
      formatSelect.value = "application/pdf";
    }
  } else if (firstFile.type === "application/pdf") {
    formatSelect.value = "image/jpeg";
  } else if (firstFile.name.endsWith(".docx")) {
    formatSelect.value = "application/pdf";
  }
}

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    selectedFiles = [];
    fileInput.value = "";
    fileInfo.innerHTML = "";
    resultDiv.innerHTML = "";
    if (widthInput) widthInput.value = "";
    if (heightInput) heightInput.value = "";
    clearBtn.style.display = "none";
  });
}

// 4. Clickable Tool Cards
toolCards.forEach((card) => {
  card.addEventListener("click", () => {
    const targetFormat = card.getAttribute("data-format");
    const targetQuality = card.getAttribute("data-quality");
    if (targetFormat && formatSelect) formatSelect.value = targetFormat;
    if (targetQuality && qualityInput && qualityValue) {
      qualityInput.value = targetQuality;
      qualityValue.textContent = `${targetQuality}%`;
    }
    const targetSection = document.getElementById("converter");
    if (targetSection) targetSection.scrollIntoView({ behavior: "smooth" });
  });
});

// === CONVERSION ENGINES ===

// A. Image -> Image (JPG / PNG / WebP)
function convertImageToImage(file, format, quality, customW, customH) {
  return new Promise((resolve) => {
    const originalUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const targetW = customW ? parseInt(customW, 10) : img.width;
      const targetH = customH ? parseInt(customH, 10) : img.height;
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext("2d");
      if (format === "image/jpeg") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      canvas.toBlob(
        (blob) => {
          const ext = format.split("/")[1] === "jpeg" ? "jpg" : format.split("/")[1];
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          resolve([
            {
              fileName: `${baseName}_ConvertX.${ext}`,
              blob,
              url: URL.createObjectURL(blob),
              originalUrl,
              originalSize: file.size,
              newSize: blob.size,
              dimensions: `${targetW}×${targetH}`,
              isImage: true
            }
          ]);
        },
        format,
        quality
      );
    };
    img.src = originalUrl;
  });
}

// B. Images -> PDF
async function convertImagesToPDF(imageFiles) {
  const { PDFDocument } = PDFLib;
  const pdfDoc = await PDFDocument.create();

  for (const file of imageFiles) {
    const arrayBuffer = await file.arrayBuffer();
    let embeddedImg;
    if (file.type === "image/png") {
      embeddedImg = await pdfDoc.embedPng(arrayBuffer);
    } else if (file.type === "image/jpeg") {
      embeddedImg = await pdfDoc.embedJpg(arrayBuffer);
    } else {
      const pngData = await convertImageToImage(file, "image/png", 1, "", "");
      const pngBuffer = await pngData[0].blob.arrayBuffer();
      embeddedImg = await pdfDoc.embedPng(pngBuffer);
    }

    const page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: embeddedImg.width,
      height: embeddedImg.height
    });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const totalOrig = imageFiles.reduce((acc, f) => acc + f.size, 0);

  return [
    {
      fileName: "ConvertX_Document.pdf",
      blob,
      url: URL.createObjectURL(blob),
      originalSize: totalOrig,
      newSize: blob.size,
      isImage: false
    }
  ];
}

// C. PDF -> Images OR Word (.doc) / TXT
async function convertFromPDF(file, targetFormat, quality) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const outputs = [];

  if (targetFormat.startsWith("image/")) {
    const ext = targetFormat.split("/")[1] === "jpeg" ? "jpg" : targetFormat.split("/")[1];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");

      if (targetFormat === "image/jpeg") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise((res) => canvas.toBlob(res, targetFormat, quality));

      outputs.push({
        fileName: `${baseName}_Page${pageNum}.${ext}`,
        blob,
        url: URL.createObjectURL(blob),
        originalSize: file.size,
        newSize: blob.size,
        dimensions: `${viewport.width}×${viewport.height}`,
        isImage: true
      });
    }
  } else {
    let fullText = "";
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ");
      fullText += `--- Page ${pageNum} ---\n${pageText}\n\n`;
    }

    const isWord = targetFormat === "application/msword";
    const blobContent = isWord
      ? `<html><body><pre style="font-family:Arial,sans-serif;white-space:pre-wrap;">${fullText}</pre></body></html>`
      : fullText;
    const blob = new Blob([blobContent], { type: targetFormat });

    outputs.push({
      fileName: `${baseName}_ConvertX.${isWord ? "doc" : "txt"}`,
      blob,
      url: URL.createObjectURL(blob),
      originalSize: file.size,
      newSize: blob.size,
      isImage: false
    });
  }

  return outputs;
}

// D. Word (.docx) or Text (.txt) -> PDF / DOC / TXT
async function convertFromWordOrText(file, targetFormat) {
  const baseName = file.name.replace(/\.[^/.]+$/, "");
  let extractedText = "";

  if (file.name.endsWith(".docx") && typeof mammoth !== "undefined") {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    extractedText = result.value;
  } else {
    extractedText = await file.text();
  }

  if (targetFormat === "application/pdf") {
    const { PDFDocument, StandardFonts } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 11;
    const margin = 50;
    const pageWidth = 595;
    const pageHeight = 842;
    const maxLineWidth = pageWidth - margin * 2;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const paragraphs = extractedText.split("\n");
    for (const para of paragraphs) {
      const words = para.split(" ");
      let line = "";
      for (const word of words) {
        const testLine = line + word + " ";
        const width = font.widthOfTextAtSize(testLine, fontSize);
        if (width > maxLineWidth && line !== "") {
          if (y < margin + 20) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            y = pageHeight - margin;
          }
          page.drawText(line.trim(), { x: margin, y, size: fontSize, font });
          y -= 16;
          line = word + " ";
        } else {
          line = testLine;
        }
      }
      if (line.trim() !== "") {
        if (y < margin + 20) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(line.trim(), { x: margin, y, size: fontSize, font });
        y -= 16;
      }
      y -= 6;
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    return [
      {
        fileName: `${baseName}_ConvertX.pdf`,
        blob,
        url: URL.createObjectURL(blob),
        originalSize: file.size,
        newSize: blob.size,
        isImage: false
      }
    ];
  } else {
    const isWord = targetFormat === "application/msword";
    const blob = new Blob([extractedText], { type: targetFormat });
    return [
      {
        fileName: `${baseName}_ConvertX.${isWord ? "doc" : "txt"}`,
        blob,
        url: URL.createObjectURL(blob),
        originalSize: file.size,
        newSize: blob.size,
        isImage: false
      }
    ];
  }
}

// === MAIN BUTTON HANDLER ===
if (convertBtn) {
  convertBtn.addEventListener("click", async () => {
    if (selectedFiles.length === 0) {
      alert("Please select at least one file first!");
      return;
    }

    const originalBtnText = convertBtn.textContent;
    convertBtn.disabled = true;
    convertBtn.textContent = "Processing...";
    resultDiv.innerHTML = "";

    const targetFormat = formatSelect.value;
    const quality = qualityInput ? parseInt(qualityInput.value, 10) / 100 : 0.9;
    const customW = widthInput ? widthInput.value : "";
    const customH = heightInput ? heightInput.value : "";

    let allConverted = [];

    try {
      const allAreImages = selectedFiles.every((f) => f.type.startsWith("image/"));

      if (allAreImages && targetFormat === "application/pdf") {
        allConverted = await convertImagesToPDF(selectedFiles);
      } else {
        for (const file of selectedFiles) {
          if (file.type.startsWith("image/")) {
            const res = await convertImageToImage(file, targetFormat, quality, customW, customH);
            allConverted.push(...res);
          } else if (file.type === "application/pdf") {
            const res = await convertFromPDF(file, targetFormat, quality);
            allConverted.push(...res);
          } else if (file.name.endsWith(".docx") || file.type === "text/plain") {
            const res = await convertFromWordOrText(file, targetFormat);
            allConverted.push(...res);
          } else {
            alert(`Unsupported file type: ${file.name}`);
          }
        }
      }

      allConverted.forEach((item) => {
        const card = document.createElement("div");
        card.className = "result-card";
        card.innerHTML = `
          ${
            item.isImage
              ? `<div class="preview-box" style="margin-bottom:10px;"><img src="${item.url}" alt="Converted"></div>`
              : `<div style="font-size:2.5rem; margin:10px 0;">📄</div>`
          }
          <div style="font-size:0.85rem; font-weight:600; word-break:break-all;">${item.fileName}</div>
          <div class="size-badge">${formatBytes(item.originalSize)} → ${formatBytes(item.newSize)} ${item.dimensions ? `(${item.dimensions})` : ""}</div>
          <br>
          <a href="${item.url}" download="${item.fileName}" class="download-link">Download File</a>
        `;
        resultDiv.appendChild(card);
      });

      if (allConverted.length > 1 && typeof JSZip !== "undefined") {
        const zipBanner = document.createElement("div");
        zipBanner.className = "zip-banner";
        zipBanner.innerHTML = `
          <p style="margin:0 0 8px 0; font-weight:600;">All ${allConverted.length} files are ready!</p>
          <button id="downloadZipBtn" class="zip-btn">Download All as ZIP</button>
        `;
        resultDiv.prepend(zipBanner);

        document.getElementById("downloadZipBtn").addEventListener("click", async () => {
          const zip = new JSZip();
          allConverted.forEach((item) => zip.file(item.fileName, item.blob));
          const zipBlob = await zip.generateAsync({ type: "blob" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(zipBlob);
          a.download = "ConvertX_Files.zip";
          a.click();
        });
      }
    } catch (err) {
      console.error(err);
      alert("Error converting file. Make sure the file is valid and not password-protected.");
    }

    convertBtn.disabled = false;
    convertBtn.textContent = originalBtnText;
  });
}
