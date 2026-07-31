export function isCheckerboardPixel(red: number, green: number, blue: number) {
  return red > 190 && Math.max(red, green, blue) - Math.min(red, green, blue) < 10;
}
