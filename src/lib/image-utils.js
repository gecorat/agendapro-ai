// Convierte una imagen a WebP y la redimensiona ANTES de subirla — todo del lado del
// navegador, sin tocar el servidor. Para una foto de perfil no hace falta más resolución
// que esta, y WebP pesa bastante menos que JPG/PNG a calidad similar.
export function convertImageToWebP(file, { maxDimension = 512, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("El archivo no es una imagen"));
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("No se pudo convertir la imagen")); return; }
          const webpFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, "") + ".webp",
            { type: "image/webp" }
          );
          resolve(webpFile);
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = objectUrl;
  });
}
