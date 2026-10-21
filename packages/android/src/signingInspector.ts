import crypto from 'node:crypto';
import type { AndroidSigningInfo, CertificateMetadata } from '@deploylens/contracts';

const APK_SIG_BLOCK_MAGIC = Buffer.from('APK Sig Block 42', 'ascii');
const ID_APK_SIGNATURE_SCHEME_V2 = 0x7109871a;
const ID_APK_SIGNATURE_SCHEME_V3 = 0xf05368c0;
// APK v4 signatures are detached .idsig files, not signing-block entries.
const ID_APK_SIGNATURE_SCHEME_V31 = 0x1b93ad61;

export interface RawSigningBlockInspection {
  hasSigningBlock: boolean;
  schemeV2: boolean;
  schemeV3: boolean;
  schemeV4: boolean;
  certificates: Buffer[];
}

export function inspectApkSigningBlock(fileBuffer: Buffer): RawSigningBlockInspection {
  const result: RawSigningBlockInspection = {
    hasSigningBlock: false,
    schemeV2: false,
    schemeV3: false,
    schemeV4: false,
    certificates: [],
  };

  // Find End of Central Directory Record (EOCD)
  // EOCD is located in the last 65KB of the file
  const maxSearch = Math.min(fileBuffer.length, 65557);
  const searchStart = fileBuffer.length - maxSearch;
  let eocdOffset = -1;

  for (let i = fileBuffer.length - 22; i >= searchStart; i--) {
    if (fileBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) return result;

  const cdOffset = fileBuffer.readUInt32LE(eocdOffset + 16);
  if (cdOffset < 24 || cdOffset > fileBuffer.length) return result;

  // The 16 bytes immediately before the central directory must contain the magic: "APK Sig Block 42"
  const magicOffset = cdOffset - 16;
  const magic = fileBuffer.subarray(magicOffset, cdOffset);
  if (!magic.equals(APK_SIG_BLOCK_MAGIC)) {
    return result;
  }

  result.hasSigningBlock = true;

  // Read block size (8 bytes before magic)
  const blockSize = Number(fileBuffer.readBigUInt64LE(magicOffset - 8));
  const blockStart = cdOffset - blockSize - 8;
  if (blockStart < 0 || blockStart > fileBuffer.length) return result;

  let current = blockStart + 8;
  const blockEnd = magicOffset - 8;

  while (current + 12 <= blockEnd) {
    const pairLength = Number(fileBuffer.readBigUInt64LE(current));
    const pairId = fileBuffer.readUInt32LE(current + 8);
    const dataStart = current + 12;
    const dataEnd = current + 8 + pairLength;

    if (dataEnd > blockEnd) break;

    if (pairId === ID_APK_SIGNATURE_SCHEME_V2) {
      result.schemeV2 = true;
      extractCertificatesFromSchemePayload(fileBuffer.subarray(dataStart, dataEnd), result.certificates);
    } else if (pairId === ID_APK_SIGNATURE_SCHEME_V3 || pairId === ID_APK_SIGNATURE_SCHEME_V31) {
      result.schemeV3 = true;
      extractCertificatesFromSchemePayload(fileBuffer.subarray(dataStart, dataEnd), result.certificates);

    }

    current += 8 + pairLength;
  }

  return result;
}

function extractCertificatesFromSchemePayload(payload: Buffer, certList: Buffer[]) {
  try {
    if (payload.length < 4) return;
    let offset = 0;
    const signersLen = payload.readUInt32LE(offset);
    offset += 4;
    let signersEnd = Math.min(offset + signersLen, payload.length);

    while (offset + 4 <= signersEnd) {
      const signerLen = payload.readUInt32LE(offset);
      offset += 4;
      const signerDataEnd = offset + signerLen;
      if (signerDataEnd > signersEnd) break;

      // Inside signer: signedDataLen (4 bytes), signedData
      if (offset + 4 <= signerDataEnd) {
        const signedDataLen = payload.readUInt32LE(offset);
        offset += 4;
        const signedDataEnd = offset + signedDataLen;

        // Skip digests
        if (offset + 4 <= signedDataEnd) {
          const digestsLen = payload.readUInt32LE(offset);
          offset += 4 + digestsLen;

          // Certificates sequence
          if (offset + 4 <= signedDataEnd) {
            const certsLen = payload.readUInt32LE(offset);
            offset += 4;
            const certsEnd = offset + certsLen;

            while (offset + 4 <= certsEnd) {
              const certLen = payload.readUInt32LE(offset);
              offset += 4;
              if (offset + certLen <= certsEnd) {
                const certBytes = payload.subarray(offset, offset + certLen);
                certList.push(Buffer.from(certBytes));
                offset += certLen;
              } else {
                break;
              }
            }
          }
        }
      }
      offset = signerDataEnd;
    }
  } catch {
    // Graceful parse fallback
  }
}

export function buildCertificateMetadata(certDer: Buffer): CertificateMetadata {
  // Hash an actual DER certificate, never a PKCS#7 container or signature file.
  const cert = new crypto.X509Certificate(certDer);
  return {
    subject: cert.subject,
    issuer: cert.issuer,
    fingerprintSha256: cert.fingerprint256,
    validFrom: cert.validFrom,
    validUntil: cert.validTo,
    serialNumber: cert.serialNumber,
  };
}

function tryCertificate(certDer: Buffer): CertificateMetadata[] {
  try { return [buildCertificateMetadata(certDer)]; } catch { return []; }
}



export function synthesizeAndroidSigningInfo(options: {
  isAab: boolean;
  hasMetaInfSignature: boolean;
  apkSigBlock: RawSigningBlockInspection;
  metaInfCert?: Buffer;
}): AndroidSigningInfo {
  const { isAab, hasMetaInfSignature, apkSigBlock, metaInfCert } = options;
  const signers: CertificateMetadata[] = [];
  const warnings: string[] = [];

  if (isAab) {
    // For AAB: Uses JAR signature scheme in META-INF
    const verified = false;
    if (metaInfCert) {
      signers.push(...tryCertificate(metaInfCert));
    }

    warnings.push(hasMetaInfSignature ? 'Signature files present; cryptographic JAR verification is required.' : 'No JAR signature files present.');

    return {
      schemeV1: hasMetaInfSignature,
      schemeV2: false,
      schemeV3: false,
      schemeV4: false,
      signingVerified: verified,
      verificationOutcome: hasMetaInfSignature ? 'not-checked' : 'fail',
      isBundleSigning: true,
      signers,
      storeCertificateMatchVerified: false,
      warnings,
    };
  }

  // APK inspection
  for (const cert of apkSigBlock.certificates) {
    signers.push(...tryCertificate(cert));
  }

  if (signers.length === 0 && metaInfCert) {
    signers.push(...tryCertificate(metaInfCert));
  }

  const hasV2orV3 = apkSigBlock.schemeV2 || apkSigBlock.schemeV3;
  const signaturePresent = hasV2orV3 || hasMetaInfSignature;
  const verified = false;

  warnings.push(signaturePresent ? 'Signing structures present; apksigner verification is required.' : 'No APK signing structures found.');

  return {
    schemeV1: hasMetaInfSignature,
    schemeV2: apkSigBlock.schemeV2,
    schemeV3: apkSigBlock.schemeV3,
    schemeV4: apkSigBlock.schemeV4,
    signingVerified: verified,
    verificationOutcome: signaturePresent ? 'not-checked' : 'fail',
    isBundleSigning: false,
    signers,
    storeCertificateMatchVerified: false,
    warnings,
  };
}
