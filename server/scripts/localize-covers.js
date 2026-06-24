// Одноразовая подготовка обложек базовых рецептов.
//
// Скачивает исходные файлы с Wikimedia Commons, сжимает их в WebP (обложка ≤1000px
// и миниатюра ≤400px — те же пресеты, что у пользовательских загрузок) и кладёт в
// `client/public/seed-images/`, откуда они едут вместе с фронтендом и раздаются тем же
// статик-хостом (nginx/Vite), что и `index.html` — без проксирования на Node. После
// этого клиенты грузят обложки только с собственного origin, без обращений к внешнему
// (и часто заблокированному) хосту.
//
// Запуск (нужен доступ в интернет): `node scripts/localize-covers.js`.
// Идемпотентно: уже скачанные файлы пропускаются (--force перезаписывает).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { COVER_SOURCES, WIKIMEDIA_FILE_URL } from "../seed-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "..", "client", "public", "seed-images");
const FORCE = process.argv.includes("--force");

const COVER = { width: 1000, quality: 78 };
const THUMB = { width: 400, quality: 70 };

// Если за прокси (HTTPS_PROXY) — запускайте с NODE_USE_ENV_PROXY=1, чтобы global fetch
// ходил через него: `NODE_USE_ENV_PROXY=1 node scripts/localize-covers.js`.
fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wikimedia ограничивает частоту (429). Качаем по одному с паузой и ретраями с
// экспоненциальным backoff, уважая заголовок Retry-After. UA — описательный с контактом
// (того требуют правила Wikimedia, иначе они отдают 429/403).
const UA = "SnedkaCoverPrep/1.0 (https://snedka.app; cover localization)";
async function fetchWithRetry(url, attempt = 0) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 429 || res.status === 503) {
    if (attempt >= 6) throw new Error(`HTTP ${res.status} (исчерпаны попытки)`);
    const ra = Number(res.headers.get("retry-after"));
    const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(30000, 2000 * 2 ** attempt);
    await sleep(wait);
    return fetchWithRetry(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const entries = Object.entries(COVER_SOURCES);
console.log(`Обложек к подготовке: ${entries.length}. Каталог: ${OUT_DIR}`);

let done = 0, skipped = 0, failed = 0, bytes = 0;
const failures = [];

for (const [name, file] of entries) {
  const coverPath = path.join(OUT_DIR, `${name}.webp`);
  const thumbPath = path.join(OUT_DIR, `${name}_thumb.webp`);
  if (!FORCE && fs.existsSync(coverPath) && fs.existsSync(thumbPath)) {
    skipped++;
    continue;
  }
  const url = WIKIMEDIA_FILE_URL(file);
  try {
    const buf = await fetchWithRetry(url);
    const base = sharp(buf, { failOn: "none" }).rotate();
    await base.clone().resize({ width: COVER.width, withoutEnlargement: true })
      .webp({ quality: COVER.quality }).toFile(coverPath);
    await base.clone().resize({ width: THUMB.width, withoutEnlargement: true })
      .webp({ quality: THUMB.quality }).toFile(thumbPath);
    bytes += fs.statSync(coverPath).size + fs.statSync(thumbPath).size;
    done++;
    process.stdout.write(`\r✓ ${done + skipped}/${entries.length}  `);
    await sleep(350); // вежливый троттлинг между запросами
  } catch (e) {
    failed++;
    failures.push(`${file} (${name}): ${e.message}`);
  }
}

console.log(`\nГотово: скачано ${done}, пропущено ${skipped}, ошибок ${failed}.`);
console.log(`Размер новых файлов: ${(bytes / 1024 / 1024).toFixed(1)} МБ.`);
if (failures.length) {
  console.log("\nНе удалось скачать:");
  for (const f of failures) console.log("  - " + f);
  process.exitCode = 1;
}
