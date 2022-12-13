
import path from 'path';
import { writeFile, rename, unlink } from 'fs/promises';

const pkgFolder = path.resolve();
const distFolder = path.join(pkgFolder, 'dist/cjs/');

await writeFile(path.join(distFolder, 'package.json'), JSON.stringify({ type: "commonjs" }, null, '  '));



