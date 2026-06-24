const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const targets = [
  { dir: 'public', svg: 'public/favicon.svg' },
  { dir: 'mobile-site/public', svg: 'mobile-site/public/favicon.svg' }
];

async function generate() {
  for (const target of targets) {
    const iconsDir = path.join(target.dir, 'icons');
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    const svgPath = target.svg;
    if (!fs.existsSync(svgPath)) {
      console.log(`SVG not found: ${svgPath}`);
      continue;
    }

    console.log(`Generating icons for ${target.dir} from ${svgPath}...`);

    // Standard 192x192
    await sharp(svgPath)
      .resize(192, 192)
      .png()
      .toFile(path.join(iconsDir, 'icon-192.png'));

    // Standard 512x512
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(path.join(iconsDir, 'icon-512.png'));

    // Maskable 192x192: Popcorn bucket with padding, transparent background
    const icon192Buffer = await sharp(svgPath)
      .resize(120, 120) // Resize SVG to fit safe zone
      .toBuffer();
    await sharp({
      create: {
        width: 192,
        height: 192,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 } // transparent
      }
    })
      .composite([{ input: icon192Buffer, gravity: 'center' }])
      .png()
      .toFile(path.join(iconsDir, 'icon-192-maskable.png'));

    // Maskable 512x512: Popcorn bucket with padding, transparent background
    const icon512Buffer = await sharp(svgPath)
      .resize(320, 320) // Resize SVG to fit safe zone
      .toBuffer();
    await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 } // transparent
      }
    })
      .composite([{ input: icon512Buffer, gravity: 'center' }])
      .png()
      .toFile(path.join(iconsDir, 'icon-512-maskable.png'));

    console.log(`Successfully generated icons for ${target.dir}.`);
  }
}

generate().catch(err => {
  console.error('Error generating icons:', err);
});
