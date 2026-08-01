export function isCheckerboardBackdrop(red: number, green: number, blue: number) {
  return red >= 145 && red <= 210 && Math.max(red, green, blue) - Math.min(red, green, blue) < 12;
}

export function clearEdgeConnectedBackdrop(width: number, height: number, pixels: Uint8ClampedArray) {
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const enqueue = (index: number) => {
    if (seen[index]) return;
    const offset = index * 4;
    if (!isCheckerboardBackdrop(pixels[offset], pixels[offset + 1], pixels[offset + 2])) return;
    seen[index] = 1; queue[tail++] = index;
  };
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++], x = index % width, y = Math.floor(index / width);
    pixels[index * 4 + 3] = 0;
    if (x) enqueue(index - 1);
    if (x < width - 1) enqueue(index + 1);
    if (y) enqueue(index - width);
    if (y < height - 1) enqueue(index + width);
  }
}
