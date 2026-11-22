import { Asset } from 'expo-asset';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, FileMode, Paths, type FileHandle } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Unzip, UnzipInflate, Zip, ZipPassThrough } from 'fflate';
import { AppError } from '../domain/errors';
import { filenameKey, TRANSFER_LIMITS, validFilename, type CatalogWorkbook } from '../domain/catalog-transfer';
import { readZipIndex, updateCrc } from '../domain/zip';
import type { Catalog, Photo } from '../domain/types';
import { discardPreparedPhotos, photoSource, preparePhotoFiles } from './images';

export interface ExportFiles { workbook: string; photos?: string; directory: string }
export type TransferProgress = (done: number, total: number) => void;
const yieldFrame = () => new Promise<void>(resolve => setTimeout(resolve, 0));
// Delay spreadsheet initialization until a staff transfer actually needs it.
function workbookCodec(): typeof import('./workbook') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro can initialize this large module on the first transfer instead of staff entry.
  return require('./workbook');
}
function check(signal?: AbortSignal) { if (signal?.aborted) throw new AppError('TRANSFER_CANCELED'); }
function freeSpace(bytes: number) { if (Paths.availableDiskSpace < bytes + 30 * 1024 * 1024) throw new AppError('STORAGE_FULL'); }
function tempDirectory() {
  const directory = new Directory(Paths.cache, 'arwana-transfers', Crypto.randomUUID());
  directory.create({ intermediates: true });
  return directory;
}
function removeDirectory(directory: Directory) { try { if (directory.exists) directory.delete(); } catch { /* The OS can reclaim the cache. */ } }

export async function pickWorkbook(signal?: AbortSignal): Promise<{ name: string; workbook: CatalogWorkbook } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'], copyToCacheDirectory: true });
  check(signal);
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!/\.xlsx$/i.test(asset.name)) throw new AppError('INVALID_WORKBOOK');
  const file = new File(asset.uri);
  if (file.size > TRANSFER_LIMITS.workbookBytes) throw new AppError('TRANSFER_LIMIT');
  const bytes = await file.bytes();
  await yieldFrame();
  check(signal);
  const { decodeWorkbook } = workbookCodec();
  const workbook = decodeWorkbook(bytes);
  check(signal);
  return { name: asset.name, workbook };
}

async function extractImages(archive: File, directory: Directory, remainingBytes: number, signal?: AbortSignal): Promise<{ name: string; file: File }[]> {
  if (archive.size > TRANSFER_LIMITS.totalImageBytes + 2 * 1024 * 1024) throw new AppError('TRANSFER_LIMIT');
  const input = archive.open(FileMode.ReadOnly);
  const handles = new Set<FileHandle>();
  try {
    const entries = readZipIndex(archive.size, (offset, length) => { input.offset = offset; return input.readBytesSync(length); }, remainingBytes);
    const index = new Map(entries.map(entry => [entry.name, entry]));
    freeSpace(entries.reduce((total, entry) => total + entry.size, 0));
    const result: { name: string; file: File }[] = [];
    const names = new Set<string>();
    const seen = new Set<string>();
    let complete = 0;
    const unzip = new Unzip(entry => {
      const expected = index.get(entry.name);
      if (!expected || seen.has(entry.name)) throw new AppError('INVALID_ARCHIVE');
      seen.add(entry.name);
      const name = entry.name.split('/').at(-1)!;
      const isImage = !entry.name.startsWith('__MACOSX/') && validFilename(name);
      let output: FileHandle | undefined;
      if (isImage) {
        if (expected.size > TRANSFER_LIMITS.imageBytes || result.length >= TRANSFER_LIMITS.photos) throw new AppError('TRANSFER_LIMIT');
        if (names.has(filenameKey(name))) throw new AppError('DUPLICATE_FILENAME');
        names.add(filenameKey(name));
        const file = new File(directory, `${Crypto.randomUUID()}.${name.split('.').at(-1)!.toLowerCase()}`);
        file.create();
        output = file.open(FileMode.WriteOnly);
        handles.add(output);
        result.push({ name, file });
      }
      let count = 0;
      let crc = -1;
      entry.ondata = (error, bytes, final) => {
        check(signal);
        if (error) throw new AppError('INVALID_ARCHIVE');
        count += bytes.length;
        if (count > expected.size) throw new AppError('TRANSFER_LIMIT');
        crc = updateCrc(crc, bytes);
        output?.writeBytesSync(bytes);
        if (final) {
          if (count !== expected.size || ((crc ^ -1) >>> 0) !== expected.crc) throw new AppError('INVALID_ARCHIVE');
          if (output) { output.close(); handles.delete(output); }
          complete++;
        }
      };
      entry.start();
    });
    unzip.register(UnzipInflate);
    input.offset = 0;
    let processed = 0;
    while (processed < archive.size) {
      check(signal);
      const bytes = await input.readBytes(16384);
      if (!bytes.length) throw new AppError('INVALID_ARCHIVE');
      processed += bytes.length;
      unzip.push(bytes, processed === archive.size);
      await yieldFrame();
    }
    if (complete !== entries.length) throw new AppError('INVALID_ARCHIVE');
    if (!result.length) throw new AppError('IMAGE_MISSING');
    return result;
  } finally {
    input.close();
    for (const handle of handles) handle.close();
  }
}

/** A failed selection never replaces the previously staged image set. */
export async function pickImportImages(onProgress: TransferProgress, signal?: AbortSignal): Promise<Map<string, Photo> | null> {
  const selection = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/zip', 'application/x-zip-compressed'], multiple: true, copyToCacheDirectory: true });
  check(signal);
  if (selection.canceled) return null;
  if (selection.assets.length > TRANSFER_LIMITS.photos) throw new AppError('TRANSFER_LIMIT');
  const directory = tempDirectory();
  const prepared = new Map<string, Photo>();
  try {
    const inputs: { name: string; file: File }[] = [];
    let selectedBytes = 0;
    for (const asset of selection.assets) {
      check(signal);
      const file = new File(asset.uri);
      let added: { name: string; file: File }[];
      if (/\.zip$/i.test(asset.name)) added = await extractImages(file, directory, TRANSFER_LIMITS.totalImageBytes - selectedBytes, signal);
      else if (validFilename(asset.name)) added = [{ name: asset.name, file }];
      else throw new AppError('IMPORT_FAILED', asset.name);
      for (const input of added) {
        selectedBytes += input.file.size;
        if (input.file.size > TRANSFER_LIMITS.imageBytes || selectedBytes > TRANSFER_LIMITS.totalImageBytes) throw new AppError('TRANSFER_LIMIT');
      }
      inputs.push(...added);
      if (inputs.length > TRANSFER_LIMITS.photos) throw new AppError('TRANSFER_LIMIT');
    }
    const names = new Set<string>();
    let total = 0;
    for (const input of inputs) {
      if (names.has(filenameKey(input.name))) throw new AppError('DUPLICATE_FILENAME');
      names.add(filenameKey(input.name));
      total += input.file.size;
      if (input.file.size > TRANSFER_LIMITS.imageBytes || total > TRANSFER_LIMITS.totalImageBytes) throw new AppError('TRANSFER_LIMIT');
    }
    onProgress(0, inputs.length);
    for (const input of inputs) {
      check(signal);
      try {
        const [photo] = await preparePhotoFiles([{ uri: input.file.uri, fileSize: input.file.size }], undefined, signal);
        prepared.set(filenameKey(input.name), photo);
      } catch (error) { throw error instanceof AppError ? new AppError(error.code, input.name) : new AppError('IMPORT_FAILED', input.name); }
      onProgress(prepared.size, inputs.length);
      await yieldFrame();
    }
    check(signal);
    return prepared;
  } catch (error) { discardPreparedPhotos(prepared.values()); throw error; }
  finally { removeDirectory(directory); }
}

export async function createExport(catalog: Catalog | undefined, onProgress: TransferProgress, signal?: AbortSignal): Promise<ExportFiles> {
  const directory = tempDirectory();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  try {
    check(signal);
    const workbook = new File(directory, catalog ? `arwana-${stamp}.xlsx` : 'arwana-template.xlsx');
    freeSpace(TRANSFER_LIMITS.workbookBytes);
    await yieldFrame();
    const { encodeWorkbook, exportFilename } = workbookCodec();
    await workbook.write(encodeWorkbook(catalog));
    if (!catalog) return { workbook: workbook.uri, directory: directory.uri };
    const archive = new File(directory, `arwana-photos-${stamp}.zip`);
    archive.create();
    const output = archive.open(FileMode.WriteOnly);
    const zip = new Zip((error, bytes) => {
      if (error) throw new AppError('TRANSFER_FAILED');
      output.writeBytesSync(bytes);
    });
    let total = 0;
    try {
      for (let index = 0; index < catalog.photos.length; index++) {
        check(signal);
        const source = photoSource(catalog.photos[index]);
        if (!source) throw new AppError('IMAGE_MISSING');
        let uri: string;
        if (typeof source === 'number') {
          const asset = await Asset.fromModule(source).downloadAsync();
          if (!asset.localUri) throw new AppError('IMAGE_MISSING');
          uri = asset.localUri;
        } else uri = source.uri;
        const file = new File(uri);
        if (!file.exists) throw new AppError('IMAGE_MISSING');
        total += file.size;
        if (file.size > TRANSFER_LIMITS.imageBytes || total > TRANSFER_LIMITS.totalImageBytes) throw new AppError('TRANSFER_LIMIT');
        freeSpace(file.size);
        const entry = new ZipPassThrough(`photos/${exportFilename(index)}`);
        zip.add(entry);
        const input = file.open(FileMode.ReadOnly);
        try {
          let processed = 0;
          while (processed < file.size) {
            check(signal);
            const bytes = await input.readBytes(65536);
            if (!bytes.length) throw new AppError('IMAGE_MISSING');
            processed += bytes.length;
            entry.push(bytes, processed === file.size);
            await yieldFrame();
          }
          if (!file.size) throw new AppError('IMAGE_MISSING');
        } finally { input.close(); }
        onProgress(index + 1, catalog.photos.length);
      }
      check(signal);
      zip.end();
    } finally { zip.terminate(); output.close(); }
    return { workbook: workbook.uri, photos: archive.uri, directory: directory.uri };
  } catch (error) { removeDirectory(directory); throw error; }
}

export async function shareExport(uri: string, isZip = false) {
  if (!await Sharing.isAvailableAsync()) throw new AppError('SHARING_UNAVAILABLE');
  if (!new File(uri).exists) throw new AppError('TRANSFER_FAILED');
  await Sharing.shareAsync(uri, {
    mimeType: isZip ? 'application/zip' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    UTI: isZip ? 'public.zip-archive' : 'org.openxmlformats.spreadsheetml.sheet',
  });
}

export function discardExport(files: ExportFiles | null) {
  if (!files) return;
  const root = new Directory(Paths.cache, 'arwana-transfers').uri;
  if (files.directory.startsWith(`${root.replace(/\/$/, '')}/`)) removeDirectory(new Directory(files.directory));
}
