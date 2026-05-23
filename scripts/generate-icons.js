const sharp = require('sharp');
const fs = require('fs');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generate() {
  if (!fs.existsSync('./public/icons')) {
    fs.mkdirSync('./public/icons');
  }
  for (const size of sizes) {
    await sharp('./public/LLC_Logo.svg')
      .resize(size, size, { fit: 'contain', background: { r: 26, g: 61, b: 43, alpha: 1 } })
      .png()
      .toFile(`./public/icons/icon-${size}x${size}.png`);
    console.log(`Generated ${size}x${size}`);
  }
}
generate();
