import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { importThermalBytes } from '@/core/importer';
import type { ThermalFrame } from '@/core/types';

async function readBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web' || /^(blob|data|https?):/.test(uri)) {
    const res = await fetch(uri);
    return new Uint8Array(await res.arrayBuffer());
  }
  return new File(uri).bytes();
}

/** Pick a file with the system document picker (keeps original bytes). */
export async function pickFromFiles(): Promise<ThermalFrame | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return importThermalBytes(await readBytes(a.uri), a.name ?? 'image');
}

/** Pick from the photo library. Some OS versions re-encode and drop FLIR segments. */
export async function pickFromPhotos(): Promise<ThermalFrame | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return importThermalBytes(await readBytes(a.uri), a.fileName ?? 'photo.jpg');
}
