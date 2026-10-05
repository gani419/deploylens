/**
 * Robust Android Binary XML (AXML) parser.
 * Directly parses compiled AndroidManifest.xml binaries into structured JSON.
 */

export interface ParsedXmlAttribute {
  namespaceUri: string;
  name: string;
  value: string;
  typedValue?: {
    type: number;
    data: number;
  };
}

export interface ParsedXmlElement {
  name: string;
  attributes: Record<string, string>;
  rawAttributes: ParsedXmlAttribute[];
  children: ParsedXmlElement[];
}

export interface ParsedManifestData {
  packageId: string;
  versionCode: number;
  versionName: string;
  minSdkVersion: number | null;
  targetSdkVersion: number | null;
  maxSdkVersion: number | null;
  maxSdkVersionDeclared: boolean;
  appLabel?: string;
  debuggable: { value: boolean; isExplicit: boolean };
  testOnly: { value: boolean; isExplicit: boolean };
  usesCleartextTraffic: boolean | null;
  networkSecurityConfigPresent: boolean;
  permissions: string[];
  features: Array<{ name: string; required: boolean }>;
  components: Array<{
    type: 'activity' | 'service' | 'receiver' | 'provider';
    name: string;
    exported: boolean;
    permission?: string;
    hasIntentFilter: boolean;
  }>;
}

// Chunk Types
const CHUNK_AXML_FILE = 0x00080003;
const CHUNK_STRING_POOL = 0x00010001;
const CHUNK_START_ELEMENT = 0x00080102;
const CHUNK_END_ELEMENT = 0x00080103;

// Attribute types
const TYPE_INT_BOOLEAN = 0x12;

export function parseAxml(buffer: Buffer): ParsedXmlElement | null {
  if (buffer.length < 8) return null;
  const magic = buffer.readUInt32LE(0);
  if (magic !== CHUNK_AXML_FILE && magic !== 0x00080000) {
    // If not binary XML, check if it's UTF-8 plain XML (such as extracted proto dump)
    const text = buffer.toString('utf8');
    if (text.includes('<manifest') || text.includes('<?xml')) {
      return parseTextManifest(text);
    }
    return null;
  }

  let offset = 8;
  let stringPool: string[] = [];
  const elementStack: ParsedXmlElement[] = [];
  let rootElement: ParsedXmlElement | null = null;

  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.readUInt32LE(offset);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkSize < 8 || offset + chunkSize > buffer.length) {
      break;
    }

    if (chunkType === CHUNK_STRING_POOL) {
      stringPool = parseStringPool(buffer, offset);
    } else if (chunkType === CHUNK_START_ELEMENT) {
      if (offset + 36 <= buffer.length) {
        const nameIdx = buffer.readInt32LE(offset + 20);
        buffer.readUInt16LE(offset + 24); // attrStart
        const attrSize = buffer.readUInt16LE(offset + 26);
        const attrCount = buffer.readUInt16LE(offset + 28);

        const elemName = nameIdx >= 0 && nameIdx < stringPool.length ? stringPool[nameIdx]! : 'unknown';
        const attributes: Record<string, string> = {};
        const rawAttrs: ParsedXmlAttribute[] = [];

        let attrOffset = offset + 36;
        for (let i = 0; i < attrCount; i++) {
          if (attrOffset + 20 > offset + chunkSize) break;
          const uriIdx = buffer.readInt32LE(attrOffset);
          const aNameIdx = buffer.readInt32LE(attrOffset + 4);
          const valIdx = buffer.readInt32LE(attrOffset + 8);
          const type = buffer.readUInt8(attrOffset + 15);
          const data = buffer.readUInt32LE(attrOffset + 16);

          const aName = aNameIdx >= 0 && aNameIdx < stringPool.length ? stringPool[aNameIdx]! : `attr_${i}`;
          const uri = uriIdx >= 0 && uriIdx < stringPool.length ? stringPool[uriIdx]! : '';

          let valStr = '';
          if (type === TYPE_INT_BOOLEAN) {
            valStr = data !== 0 ? 'true' : 'false';
          } else if (valIdx >= 0 && valIdx < stringPool.length) {
            valStr = stringPool[valIdx]!;
          } else {
            valStr = data.toString();
          }

          attributes[aName] = valStr;
          rawAttrs.push({
            namespaceUri: uri,
            name: aName,
            value: valStr,
            typedValue: { type, data },
          });

          attrOffset += attrSize > 0 ? attrSize : 20;
        }

        const newElem: ParsedXmlElement = {
          name: elemName,
          attributes,
          rawAttributes: rawAttrs,
          children: [],
        };

        if (elementStack.length > 0) {
          elementStack[elementStack.length - 1]!.children.push(newElem);
        } else if (!rootElement) {
          rootElement = newElem;
        }
        elementStack.push(newElem);
      }
    } else if (chunkType === CHUNK_END_ELEMENT) {
      elementStack.pop();
    }

    offset += chunkSize;
  }

  return rootElement;
}

function parseStringPool(buffer: Buffer, offset: number): string[] {
  const strings: string[] = [];
  if (offset + 28 > buffer.length) return strings;

  const stringCount = buffer.readUInt32LE(offset + 8);
  const flags = buffer.readUInt32LE(offset + 16);
  const stringsStart = offset + buffer.readUInt32LE(offset + 20);
  const isUtf8 = (flags & (1 << 8)) !== 0;

  const offsets: number[] = [];
  let cur = offset + 28;
  for (let i = 0; i < stringCount; i++) {
    if (cur + 4 > buffer.length) break;
    offsets.push(buffer.readUInt32LE(cur));
    cur += 4;
  }

  for (let i = 0; i < offsets.length; i++) {
    const sOffset = stringsStart + offsets[i]!;
    if (sOffset >= buffer.length) {
      strings.push('');
      continue;
    }

    if (isUtf8) {
      // UTF-8 string: length encoded as 1 or 2 bytes
      let p = sOffset;
      if (p >= buffer.length) {
        strings.push('');
        continue;
      }
      let charLen = buffer[p++]!;
      if ((charLen & 0x80) !== 0 && p < buffer.length) {
        charLen = ((charLen & 0x7f) << 8) | buffer[p++]!;
      }
      let byteLen = buffer[p++]!;
      if ((byteLen & 0x80) !== 0 && p < buffer.length) {
        byteLen = ((byteLen & 0x7f) << 8) | buffer[p++]!;
      }
      const end = Math.min(p + byteLen, buffer.length);
      strings.push(buffer.toString('utf8', p, end));
    } else {
      // UTF-16 string: length encoded as 2 or 4 bytes
      let p = sOffset;
      if (p + 2 > buffer.length) {
        strings.push('');
        continue;
      }
      let charLen = buffer.readUInt16LE(p);
      p += 2;
      if ((charLen & 0x8000) !== 0 && p + 2 <= buffer.length) {
        charLen = ((charLen & 0x7fff) << 16) | buffer.readUInt16LE(p);
        p += 2;
      }
      const byteLen = charLen * 2;
      const end = Math.min(p + byteLen, buffer.length);
      strings.push(buffer.toString('utf16le', p, end));
    }
  }

  return strings;
}

export function extractManifestMetadata(root: ParsedXmlElement): ParsedManifestData {
  const packageId = root.attributes['package'] || '';
  const versionCode = parseInt(root.attributes['versionCode'] || '1', 10);
  const versionName = root.attributes['versionName'] || '1.0.0';

  let minSdkVersion: number | null = null;
  let targetSdkVersion: number | null = null;
  let maxSdkVersion: number | null = null;
  let maxSdkVersionDeclared = false;
  let appLabel: string | undefined = undefined;
  let debuggableValue = false;
  let debuggableExplicit = false;
  let testOnlyValue = false;
  let testOnlyExplicit = false;
  let usesCleartextTraffic: boolean | null = null;
  let networkSecurityConfigPresent = false;

  const permissions: string[] = [];
  const features: Array<{ name: string; required: boolean }> = [];
  const components: ParsedManifestData['components'] = [];

  for (const child of root.children) {
    if (child.name === 'uses-sdk') {
      if (child.attributes['minSdkVersion']) {
        minSdkVersion = parseInt(child.attributes['minSdkVersion']!, 10);
      }
      if (child.attributes['targetSdkVersion']) {
        targetSdkVersion = parseInt(child.attributes['targetSdkVersion']!, 10);
      }
      if (child.attributes['maxSdkVersion'] !== undefined) {
        maxSdkVersionDeclared = true;
        maxSdkVersion = parseInt(child.attributes['maxSdkVersion']!, 10);
      }
    } else if (child.name === 'uses-permission' || child.name === 'permission') {
      const pName = child.attributes['name'];
      if (pName && !permissions.includes(pName)) {
        permissions.push(pName);
      }
    } else if (child.name === 'uses-feature') {
      const fName = child.attributes['name'];
      const required = child.attributes['required'] !== 'false';
      if (fName) {
        features.push({ name: fName, required });
      }
    } else if (child.name === 'application') {
      if (child.attributes['label']) {
        appLabel = child.attributes['label'];
      }
      if (child.attributes['debuggable'] !== undefined) {
        debuggableExplicit = true;
        debuggableValue = child.attributes['debuggable'] === 'true';
      }
      if (child.attributes['testOnly'] !== undefined) {
        testOnlyExplicit = true;
        testOnlyValue = child.attributes['testOnly'] === 'true';
      }
      if (child.attributes['usesCleartextTraffic'] !== undefined) {
        usesCleartextTraffic = child.attributes['usesCleartextTraffic'] === 'true';
      }
      if (child.attributes['networkSecurityConfig'] !== undefined) {
        networkSecurityConfigPresent = true;
      }

      for (const compNode of child.children) {
        if (
          compNode.name === 'activity' ||
          compNode.name === 'service' ||
          compNode.name === 'receiver' ||
          compNode.name === 'provider'
        ) {
          const compName = compNode.attributes['name'] || 'unknown';
          const hasIntentFilter = compNode.children.some((c) => c.name === 'intent-filter');
          let exported = compNode.attributes['exported'] === 'true';
          if (compNode.attributes['exported'] === undefined) {
            exported = hasIntentFilter; // Android legacy resolved default
          }
          const perm = compNode.attributes['permission'];

          components.push({
            type: compNode.name as any,
            name: compName,
            exported,
            permission: perm,
            hasIntentFilter,
          });
        }
      }
    }
  }

  return {
    packageId,
    versionCode: isNaN(versionCode) ? 1 : versionCode,
    versionName,
    minSdkVersion,
    targetSdkVersion,
    maxSdkVersion,
    maxSdkVersionDeclared,
    appLabel,
    debuggable: { value: debuggableValue, isExplicit: debuggableExplicit },
    testOnly: { value: testOnlyValue, isExplicit: testOnlyExplicit },
    usesCleartextTraffic,
    networkSecurityConfigPresent,
    permissions,
    features,
    components,
  };
}

function parseTextManifest(xmlText: string): ParsedXmlElement {
  // Regex fallback parser for plaintext XML manifests
  const pkgMatch = /package=["']([^"']+)["']/.exec(xmlText);
  const vCodeMatch = /android:versionCode=["'](\d+)["']/.exec(xmlText);
  const vNameMatch = /android:versionName=["']([^"']+)["']/.exec(xmlText);
  const minSdkMatch = /android:minSdkVersion=["'](\d+)["']/.exec(xmlText);
  const targetSdkMatch = /android:targetSdkVersion=["'](\d+)["']/.exec(xmlText);
  const maxSdkMatch = /android:maxSdkVersion=["'](\d+)["']/.exec(xmlText);
  const debugMatch = /android:debuggable=["'](true|false)["']/.exec(xmlText);
  const testOnlyMatch = /android:testOnly=["'](true|false)["']/.exec(xmlText);
  const cleartextMatch = /android:usesCleartextTraffic=["'](true|false)["']/.exec(xmlText);
  const labelMatch = /android:label=["']([^"']+)["']/.exec(xmlText);

  const manifestElem: ParsedXmlElement = {
    name: 'manifest',
    attributes: {
      package: pkgMatch ? pkgMatch[1]! : 'com.example.app',
      versionCode: vCodeMatch ? vCodeMatch[1]! : '1',
      versionName: vNameMatch ? vNameMatch[1]! : '1.0.0',
    },
    rawAttributes: [],
    children: [],
  };

  const usesSdkAttrs: Record<string, string> = {};
  if (minSdkMatch) usesSdkAttrs['minSdkVersion'] = minSdkMatch[1]!;
  if (targetSdkMatch) usesSdkAttrs['targetSdkVersion'] = targetSdkMatch[1]!;
  if (maxSdkMatch) usesSdkAttrs['maxSdkVersion'] = maxSdkMatch[1]!;

  manifestElem.children.push({
    name: 'uses-sdk',
    attributes: usesSdkAttrs,
    rawAttributes: [],
    children: [],
  });

  const appAttrs: Record<string, string> = {};
  if (debugMatch) appAttrs['debuggable'] = debugMatch[1]!;
  if (testOnlyMatch) appAttrs['testOnly'] = testOnlyMatch[1]!;
  if (cleartextMatch) appAttrs['usesCleartextTraffic'] = cleartextMatch[1]!;
  if (labelMatch) appAttrs['label'] = labelMatch[1]!;

  const appElem: ParsedXmlElement = {
    name: 'application',
    attributes: appAttrs,
    rawAttributes: [],
    children: [],
  };

  // Find permissions
  const permRegex = /<uses-permission[^>]*android:name=["']([^"']+)["'][^>]*\/>/g;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = permRegex.exec(xmlText)) !== null) {
    manifestElem.children.push({
      name: 'uses-permission',
      attributes: { name: pMatch[1]! },
      rawAttributes: [],
      children: [],
    });
  }

  manifestElem.children.push(appElem);
  return manifestElem;
}
