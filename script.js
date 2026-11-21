
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const fileInfo = document.getElementById("fileInfo");
const format = document.getElementById("format");
const convertBtn = document.getElementById("convertBtn");
const result = document.getElementById("result");

let selectedFile = null;

function selectFile(file) {
  result.innerHTML = "";
  fileInfo.textContent = "";

  if (!file) return;

  const allowed = [
    "image/png",
    "image/jpeg",
    "image/webp"
  ];

  if (!allowed.includes(file.type)) {
    fileInfo.textContent = "Please select a PNG, JPG or WebP image.";
    selectedFile = null;
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    fileInfo.textContent = "Maximum file size is 10 MB.";
    selectedFile = null;
    return;
  }

  selectedFile = file;

  fileInfo.textContent =
    `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
}

fileInput.addEventListener("change", () => {
  selectFile(fileInput.files[0]);
});

dropZone.addEventListener("dragover", event => {
  event.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", event => {
  event.preventDefault();
  dropZone.classList.remove("dragover");
  selectFile(event.dataTransfer.files[0]);
});

convertBtn.addEventListener("click", () => {
  if (!selectedFile) {
    fileInfo.textContent = "Please select an image first.";
    return;
  }

  convertBtn.disabled = true;
  convertBtn.textContent = "Converting...";
  result.textContent = "";

  const image = new Image();
  const objectURL = URL.createObjectURL(selectedFile);

  image.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      const ctx = canvas.getContext("2d");

      // JPG does not support transparency.
      if (format.value === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(image, 0, 0);

      canvas.toBlob(blob => {
        URL.revokeObjectURL(objectURL);

        if (!blob) {
          result.textContent = "Conversion failed. Try another image.";
          convertBtn.disabled = false;
          convertBtn.textContent = "Convert Now";
          return;
        }

        const extension = format.value.split("/")[1]
          .replace("jpeg", "jpg");

        const downloadURL = URL.createObjectURL(blob);
        const link = document.createElement("a");

        const originalName = selectedFile.name.replace(/\.[^.]+$/, "");
        link.href = downloadURL;
        link.download = `${originalName}.${extension}`;

        link.textContent = "Download Converted File";
        link.className = "primary-btn";
        result.appendChild(link);

        convertBtn.disabled = false;
        convertBtn.textContent = "Convert Now";
      }, format.value, 0.9);

    } catch (error) {
      URL.revokeObjectURL(objectURL);
      result.textContent = "Something went wrong.";
      convertBtn.disabled = false;
      convertBtn.textContent = "Convert Now";
    }
  };

  image.onerror = () => {
    URL.revokeObjectURL(objectURL);
    result.textContent = "Unable to read this image.";
    convertBtn.disabled = false;
    convertBtn.textContent = "Convert Now";
  };

  image.src = objectURL;
});
