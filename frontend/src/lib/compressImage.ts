/**
 * 将大图压成适合头像的 JPEG，减轻上传体积与等待时间（GIF 保持原样）。
 */
export async function compressImageFileForAvatar(
  file: File,
  maxWidth = 512,
  quality = 0.85
): Promise<File> {
  if (file.size < 200 * 1024) return file
  if (file.type === 'image/gif') return file
  if (!file.type.startsWith('image/')) return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const w = img.naturalWidth
      const h = img.naturalHeight
      let tw = w
      let th = h
      if (w > maxWidth) {
        tw = maxWidth
        th = (h * maxWidth) / w
      }
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(tw)
      canvas.height = Math.round(th)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, tw, th)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const name =
            file.name.replace(/\.[^.]+$/, '.jpg') || 'avatar.jpg'
          resolve(new File([blob], name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }
    img.src = url
  })
}
