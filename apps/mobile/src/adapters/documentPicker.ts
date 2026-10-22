import {errorCodes, isErrorWithCode, keepLocalCopy, pick, types} from '@react-native-documents/picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {archiveType, validateArchive} from '@deploylens/utils';
import type {ArtifactType} from '@deploylens/contracts';

export type MobileArchive = {name: string; size: number; type: ArtifactType; localUri: string};

export async function pickBuild(limit: number): Promise<MobileArchive | null> {
  try {
    const [selected] = await pick({type: [types.allFiles], allowMultiSelection: false, mode: 'import'});
    if (!selected.name || selected.size === null) throw new Error('The selected provider did not return a filename and size. Download the build locally and try again.');
    const validation = validateArchive({name: selected.name, size: selected.size}, limit);
    if (validation) throw new Error(validation);
    if (selected.isVirtual) throw new Error('Virtual documents cannot be inspected. Download the original APK, AAB, or IPA file first.');
    const [copy] = await keepLocalCopy({destination: 'cachesDirectory', files: [{uri: selected.uri, fileName: selected.name}]});
    if (copy.status !== 'success') throw new Error(`The build could not be copied into the app cache: ${copy.copyError}`);
    return {name: selected.name, size: selected.size, type: archiveType(selected.name)!, localUri: copy.localUri};
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return null;
    throw error;
  }
}

export async function removeCachedBuild(archive: MobileArchive | null) {
  if (!archive) return;
  const path = decodeURIComponent(archive.localUri.replace(/^file:\/\//, ''));
  try { if (await ReactNativeBlobUtil.fs.exists(path)) await ReactNativeBlobUtil.fs.unlink(path); } catch { /* cache cleanup is best-effort */ }
}
