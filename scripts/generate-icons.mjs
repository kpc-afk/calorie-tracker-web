import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#18181b"/>
  <!-- Track ring -->
  <circle cx="256" cy="256" r="190" fill="none" stroke="#27272a" stroke-width="50"/>
  <!-- Green progress ring ~270deg: circ=2*pi*190=1194, dash=895.5, gap=298.5 -->
  <circle cx="256" cy="256" r="190" fill="none" stroke="#22c55e" stroke-width="50"
    stroke-dasharray="896 1194" stroke-linecap="round"
    transform="rotate(-90 256 256)"/>
  <!-- kcal text -->
  <text x="256" y="290" text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="900" font-size="118" letter-spacing="-2"
    fill="white">kcal</text>
</svg>`

const svgBuf = Buffer.from(svg)

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of sizes) {
  await sharp(svgBuf)
    .resize(size, size)
    .png()
    .toFile(join(publicDir, name))
  console.log(`✓ ${name} (${size}×${size})`)
}
