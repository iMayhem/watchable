import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, 'src');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    });
}

const replacements = [
    { from: /['"]\.\.\/\.\.\/\.\.\/src\//g, to: "'@/" },
    { from: /['"]\.\.\/\.\.\/components\//g, to: "'@/components/" },
    { from: /['"]\.\.\/\.\.\/composables\//g, to: "'@/composables/" },
    { from: /['"]\.\.\/\.\.\/utils\//g, to: "'@/utils/" },
    { from: /['"]\.\.\/\.\.\/lib\//g, to: "'@/lib/" },
    { from: /['"]\.\.\/\.\.\/routes\//g, to: "'@/routes/" },
    { from: /['"]\.\.\/\.\.\/pages\//g, to: "'@/pages/" }
];

walkDir(srcDir, (filePath) => {
    const ext = path.extname(filePath);
    if (ext !== '.vue' && ext !== '.ts') return;

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    replacements.forEach(({ from, to }) => {
        content = content.replace(from, to);
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated imports in: ${path.relative(srcDir, filePath)}`);
    }
});
