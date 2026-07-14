// Canvas-based client-side image helpers shared by photo capture flows.
// Re-encoding through canvas doubles as format normalization: anything the
// browser can decode (including HEIC on iOS) comes out as JPEG.

/** Resize a data-URL image to fit maxPx and re-encode as JPEG. Resolves with the original on failure. */
export async function compressImageDataUrl(dataUrl: string, maxPx = 1024, quality = 0.82): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width > maxPx || height > maxPx) {
                if (width >= height) {
                    height = Math.round((height / width) * maxPx);
                    width = maxPx;
                } else {
                    width = Math.round((width / height) * maxPx);
                    height = maxPx;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(dataUrl); return; }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

/**
 * Downscale + re-encode a picked photo as JPEG before upload. Gallery picks
 * can be huge camera originals (often HEIC on iPhone, which non-Safari
 * browsers can't render). If the image can't be decoded or re-encoded,
 * resolves with the ORIGINAL file — behavior then matches a raw upload.
 */
export async function prepareImageForUpload(file: File, maxPx = 1600, quality = 0.85): Promise<File> {
    try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });

        const compressed = await compressImageDataUrl(dataUrl, maxPx, quality);
        if (!compressed.startsWith('data:image/jpeg')) return file; // decode failed upstream

        const blob = await (await fetch(compressed)).blob();
        return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    } catch {
        return file;
    }
}
