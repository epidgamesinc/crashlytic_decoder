const fs = require('fs');
const iconv = require('iconv-lite');
const path = require('path');

const filesToConvert = ['popup.html', 'popup.js'];
const buildDir = path.resolve(__dirname, 'build');

filesToConvert.forEach((file) => {
  const filePath = path.join(buildDir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const encoded = iconv.encode(content, 'euc-kr');
    fs.writeFileSync(filePath, encoded);
    console.log(`Converted ${file} to EUC-KR encoding.`);
  } else {
    console.warn(`File not found: ${filePath}`);
  }
});
