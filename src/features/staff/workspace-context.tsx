import * as Crypto from 'expo-crypto';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useApp } from '../../state/AppProvider';
import { useStaffAuth } from './auth-context';
import { addDraftPhoto, addDraftTerm, draftFingerprint, previewImport, TRANSFER_LIMITS, type ImportMode, type ImportPreview } from '../../domain/catalog-transfer';
import { AppError } from '../../domain/errors';
import type { Photo, Space, Term, TermKind } from '../../domain/types';
import { createExport, discardExport, pickImportImages, pickWorkbook, shareExport, type ExportFiles } from '../../storage/catalog-files';
import { assertCatalogImages, discardPreparedPhotos, pickDraftPhoto } from '../../storage/images';

export type PhotoFieldsValue = Pick<Photo, 'room' | 'styleId' | 'paletteIds' | 'materialIds' | 'detailIds'>;
const emptyFields = (): PhotoFieldsValue => ({ room: 'bathroom', styleId: '', paletteIds: [], materialIds: [], detailIds: [] });
const emptyTerm = (kind: TermKind = 'style'): Term => ({ id: Crypto.randomUUID(), kind, labels: { ru: '', tk: '' } });

function useWorkspaceController() {
  const app = useApp();
  const auth = useStaffAuth();
  const [entryMode, setEntryMode] = useState<'photo' | 'term'>('photo');
  const [fields, setFields] = useState(emptyFields);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [photo, updatePhoto] = useState<Photo | null>(null);
  const [term, setTerm] = useState(emptyTerm);
  const [inlineTerm, setInlineTerm] = useState(false);
  const [book, setBook] = useState<Awaited<ReturnType<typeof pickWorkbook>>>(null);
  const [images, updateImages] = useState(new Map<string, Photo>());
  const [mode, setMode] = useState<ImportMode>('merge');
  const [exports, updateExports] = useState<ExportFiles | null>(null);
  const [template, updateTemplate] = useState<ExportFiles | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<'photo' | 'term' | 'import' | null>(null);
  const [confirmReplace, updateConfirmReplace] = useState(false);
  const replacement = useRef<ImportPreview | null>(null);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const owned = useRef({ photo: null as Photo | null, images: new Map<string, Photo>(), exports: null as ExportFiles | null, template: null as ExportFiles | null });
  const setPhoto = (value: Photo | null) => { owned.current.photo = value; updatePhoto(value); };
  const setImages = (value: Map<string, Photo>) => { owned.current.images = value; updateImages(value); };
  const setExports = (value: ExportFiles | null) => { owned.current.exports = value; updateExports(value); };
  const setTemplate = (value: ExportFiles | null) => { owned.current.template = value; updateTemplate(value); };
  const release = () => {
    if (owned.current.photo) discardPreparedPhotos([owned.current.photo]);
    discardPreparedPhotos(owned.current.images.values());
    discardExport(owned.current.exports);
    discardExport(owned.current.template);
    owned.current = { photo: null, images: new Map(), exports: null, template: null };
  };
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; controller.current?.abort(); if (!pending.current) release(); };
  }, []);

  const review = useMemo(() => app.draft && book ? previewImport(app.draft, book.workbook, images, mode) : null, [app.draft, book, images, mode]);
  function setConfirmReplace(visible: boolean) { replacement.current = visible ? review : null; updateConfirmReplace(visible); }
  function unlocked() { if (!auth.isUnlocked()) throw new AppError('STAFF_LOCKED'); }
  function active(signal: AbortSignal) { if (signal.aborted || !alive.current) throw new AppError('TRANSFER_CANCELED'); }
  const report = (done: number, total: number) => { if (alive.current) setProgress(`${done} / ${total}`); };
  async function run(name: string, work: (signal: AbortSignal) => Promise<void>) {
    if (pending.current || app.busy) return;
    pending.current = true;
    const abort = new AbortController();
    controller.current = abort;
    setOperation(name); setProgress(''); setError(null); setSuccess(null);
    try { unlocked(); await work(abort.signal); }
    catch (failure) { if (alive.current) setError(failure instanceof AppError ? failure : new AppError('TRANSFER_FAILED')); }
    finally {
      pending.current = false;
      controller.current = null;
      if (alive.current) { setOperation(null); setProgress(''); }
      else release();
    }
  }
  const choosePhoto = () => run('photo', async signal => {
    const next = await pickDraftPhoto(fields.room);
    if (!next) return;
    if (signal.aborted || !alive.current) { discardPreparedPhotos([next]); active(signal); }
    if (owned.current.photo) discardPreparedPhotos([owned.current.photo]);
    setPhoto(next);
  });
  const savePhoto = () => run('save', async () => {
    if (!photo) return;
    unlocked();
    await app.saveDraft(current => { unlocked(); return addDraftPhoto(current, { ...photo, ...fields }, spaces); });
    setPhoto(null); setFields(emptyFields()); setSpaces([]); setSuccess('photo');
  });
  const saveTerm = () => run('save', async () => {
    unlocked();
    await app.saveDraft(current => { unlocked(); return addDraftTerm(current, term); });
    if (inlineTerm) setFields(current => {
      if (term.kind === 'style') return { ...current, styleId: term.id };
      const field = term.kind === 'palette' ? 'paletteIds' : term.kind === 'material' ? 'materialIds' : 'detailIds';
      return { ...current, [field]: [...current[field], term.id] };
    });
    setTerm(emptyTerm(term.kind)); setInlineTerm(false); setSuccess('term');
  });
  const chooseWorkbook = () => run('workbook', async signal => {
    const next = await pickWorkbook(signal);
    active(signal);
    if (!next) return;
    discardPreparedPhotos(owned.current.images.values()); setImages(new Map());
    setBook(next); setMode('merge'); setConfirmReplace(false);
  });
  const chooseImages = () => run('images', async signal => {
    const next = await pickImportImages(report, signal);
    if (!next) return;
    if (signal.aborted || !alive.current) { discardPreparedPhotos(next.values()); active(signal); }
    const merged = new Map(owned.current.images);
    if (new Set([...merged.keys(), ...next.keys()]).size > TRANSFER_LIMITS.photos) {
      discardPreparedPhotos(next.values()); throw new AppError('TRANSFER_LIMIT');
    }
    for (const [name, prepared] of next) {
      const previous = merged.get(name);
      if (previous) discardPreparedPhotos([previous]);
      merged.set(name, prepared);
    }
    setImages(merged);
  });
  const applyImport = () => run('save', async () => {
    const candidate = confirmReplace ? replacement.current : review;
    if (!candidate || candidate.issues.length) return;
    unlocked();
    try {
      await assertCatalogImages(candidate.catalog);
      await app.saveDraft(current => {
        unlocked();
        if (draftFingerprint(current) !== candidate.base) throw new AppError('STALE_DRAFT');
        return candidate.catalog;
      });
    } catch (failure) {
      if (!(failure instanceof AppError && ['STALE_DRAFT', 'STAFF_LOCKED'].includes(failure.code))) {
        discardPreparedPhotos(owned.current.images.values()); setImages(new Map());
      }
      setConfirmReplace(false);
      throw failure;
    }
    const retained = new Set(candidate.catalog.photos.flatMap(item => item.image.kind === 'local' ? [item.image.file] : []));
    discardPreparedPhotos([...owned.current.images.values()].filter(item => item.image.kind === 'local' && !retained.has(item.image.file)));
    setImages(new Map()); setBook(null); setConfirmReplace(false); setSuccess('import');
  });
  const exportDraft = () => run('export', async signal => {
    if (!app.draft) return;
    const result = await createExport(app.draft, report, signal);
    if (signal.aborted || !alive.current) { discardExport(result); active(signal); }
    discardExport(owned.current.exports); setExports(result);
  });
  const makeTemplate = () => run('template', async signal => {
    const result = await createExport(undefined, report, signal);
    if (signal.aborted || !alive.current) { discardExport(result); active(signal); }
    discardExport(owned.current.template); setTemplate(result);
  });
  const share = (uri: string, zip = false) => run('share', async () => { unlocked(); await shareExport(uri, zip); });
  const discardForm = () => {
    if (pending.current) return;
    if (owned.current.photo) discardPreparedPhotos([owned.current.photo]);
    setPhoto(null); setFields(emptyFields()); setSpaces([]); setTerm(emptyTerm()); setInlineTerm(false); setError(null);
  };
  const discardImport = () => {
    if (pending.current) return;
    discardPreparedPhotos(owned.current.images.values()); setImages(new Map()); setBook(null); setError(null); setConfirmReplace(false);
  };
  const dirty = !!photo || JSON.stringify(fields) !== JSON.stringify(emptyFields()) || !!term.labels.ru || !!term.labels.tk || spaces.length > 0;
  return { entryMode, setEntryMode, fields, setFields, spaces, setSpaces, photo, term, setTerm, inlineTerm, setInlineTerm, book, images, mode, setMode, review, exports, template, operation, progress, error, success, dirty,
    confirmReplace, setConfirmReplace, choosePhoto, savePhoto, saveTerm, chooseWorkbook, chooseImages, applyImport, exportDraft, makeTemplate, share, discardForm, discardImport,
    cancel: () => controller.current?.abort(), busy: !!operation || app.busy,
    startTerm: (kind: TermKind) => { setTerm(emptyTerm(kind)); setInlineTerm(true); },
  };
}

const WorkspaceContext = createContext<ReturnType<typeof useWorkspaceController> | null>(null);
export function StaffWorkspaceProvider({ children }: PropsWithChildren) {
  const value = useWorkspaceController();
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
export function useStaffWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('StaffWorkspaceProvider missing');
  return value;
}
