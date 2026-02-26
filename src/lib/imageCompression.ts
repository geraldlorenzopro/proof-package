/**
 * Client-side image compression before upload.
 * Resizes to max 1920px and compresses to 80% JPEG quality.
 * Reduces storage usage by ~70%.
 */

const MAX_DIMENSION = 1920;
const QUALITY = 0.8;
const MAX_FILE_SIZE_NO_COMPRESS = 100 * 1024; // Skip files under 100KB

export async function compressImage(file: File): Promise<File> {
  // Only compress images
  if (!file.type.startsWith('image/')) return file;
  // Skip very small files
  if (file.size < MAX_FILE_SIZE_NO_COMPRESS) return file;
  // Skip non-compressible formats
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

  return new Promise<File>((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Only resize if exceeds max dimension
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // If compression didn't help, return original
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: file.lastModified,
          });
          resolve(compressed);
        },
        'image/jpeg',
        QUALITY,
      );
    };
    img.onerror = () => resolve(file); // Fallback to original
    img.src = URL.createObjectURL(file);
  });
}

export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImage));
}

export const EVIDENCE_LIMIT_PER_CASE = 50;
