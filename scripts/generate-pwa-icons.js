/**
 * Generate PWA icons from source SVG
 *
 * Creates all required icon sizes for PWA manifest:
 * - 72x72, 96x96, 128x128, 144x144, 152x152 (iOS)
 * - 192x192, 384x384, 512x512 (Android/PWA)
 *
 * Run: node scripts/generate-pwa-icons.js
 */

import sharp from 'sharp'
import { mkdir, readFile, rm } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// PWA manifest requires these sizes
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

const inputFile = join(rootDir, 'public', 'icon-source.png')
const outputDir = join(rootDir, 'public', 'icons')

async function generateIcons() {
  console.log('Generating PWA icons...\n')

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true })

  // Read source SVG
  const sourceSvg = await readFile(inputFile)
  console.log(`Source: ${inputFile}\n`)

  // Generate each size
  for (const size of SIZES) {
    const outputPath = join(outputDir, `icon-${size}x${size}.png`)

    await sharp(sourceSvg)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 220, g: 38, b: 38, alpha: 1 }, // #DC2626 red background
      })
      .png()
      .toFile(outputPath)

    console.log(`Generated ${size}x${size} → ${outputPath}`)
  }

  console.log('\nPWA icon generation complete!')
  console.log(`Output directory: ${outputDir}`)
  console.log('\nNext steps:')
  console.log('1. Review generated icons in public/icons/')
  console.log('2. Test PWA install on devices')
  console.log('3. Commit icons: git add public/icons/')
}

generateIcons().catch((err) => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
