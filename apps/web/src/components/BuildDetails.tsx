import type { ReactNode } from 'react';
import type { ScanSummary, IosMetadata } from '@deploylens/contracts';
import { size, yesNo, identity } from '@deploylens/utils';
import { StatusBadge } from './StatusBadge.js';
import { Icon } from './Icon.js';
import { PermissionUsagePanel } from './PermissionUsagePanel.js';

export function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
  return <dl className="facts-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not established'}</dd></div>)}</dl>;
}
export function DetailCard({ title, description, children, icon = 'details' }: { title: string; description?: string; children: ReactNode; icon?: string }) {
  return <section className="panel detail-card"><div className="panel-heading"><span className="heading-icon"><Icon name={icon}/></span><div><h3>{title}</h3>{description && <p>{description}</p>}</div></div>{children}</section>;
}
export function SigningDetails({ summary }: { summary: ScanSummary }) {
  const android = summary.metadata.android?.signing, ios = summary.metadata.ios?.signing;
  return <DetailCard title="Signing evidence" icon="shield" description="Package integrity and store-account identity are separate checks.">
    {android && <><Facts rows={[
      ['Cryptographic verification', <StatusBadge outcome={android.verificationOutcome ?? (android.signingVerified ? 'pass' : 'not-checked')}/>],
      ['Signing format', android.isBundleSigning ? 'JAR signature (AAB upload)' : 'APK signature'],
      ['Signature schemes detected', [android.schemeV1 && 'v1', android.schemeV2 && 'v2', android.schemeV3 && 'v3 / v3.1', android.schemeV4 && 'v4'].filter(Boolean).join(', ') || 'None established'],
      ['Play upload certificate match', android.storeCertificateMatchVerified ? 'Verified' : 'Not verified against Play Console'],
    ]}/>{android.signers.length ? android.signers.map((signer, index) => <div className="certificate" key={`${signer.fingerprintSha256}-${index}`}><h4>Certificate {index + 1}</h4><Facts rows={[
      ['Subject', signer.subject], ['Issuer', signer.issuer], ['SHA-256 fingerprint', <code>{signer.fingerprintSha256}</code>], ['Valid from', signer.validFrom || 'Not extracted'], ['Valid until', signer.validUntil || 'Not extracted'],
    ]}/></div>) : <p className="field-note">No certificate details were extracted. Signature-file presence alone is not cryptographic verification.</p>}{android.warnings.map((warning, index) => <p className="callout warning" key={index}>{warning}</p>)}</>}
    {ios && <><Facts rows={[
      ['Cryptographic verification', <StatusBadge outcome={ios.codesignCheckOutcome}/>], ['Signature structure present', yesNo(ios.isSigned)], ['Signer', ios.signerIdentity || 'Not extracted'], ['Team identifier', ios.teamId || 'Not extracted'],
      ['Embedded provisioning profile', yesNo(ios.provisioningProfilePresent)], ['Profile distribution type', ios.provisioningProfileType || 'Not established'], ['Profile expiration', ios.provisioningProfileExpiresAt || 'Not extracted'],
    ]}/>{ios.authorityNames?.length ? <p className="field-note">Certificate authorities: {ios.authorityNames.join(' → ')}</p> : null}{ios.limitations.map((limitation, index) => <p className="callout warning" key={index}>{limitation}</p>)}{ios.entitlements && <details className="raw-details"><summary>View embedded provisioning entitlements</summary><p className="field-note">Parsed profile metadata; not proof of a complete signed-entitlement match.</p><pre>{JSON.stringify(ios.entitlements, null, 2)}</pre></details>}</>}
  </DetailCard>;
}

export function BuildDetails({ summary }: { summary: ScanSummary }) {
  const app = identity(summary), android = summary.metadata.android, ios = summary.metadata.ios;
  const packaging = android?.packaging;
  const categories: Array<[string, number]> = packaging ? [['DEX bytecode', packaging.dexSizeBytes], ['Native libraries', packaging.nativeLibsSizeBytes], ['Assets', packaging.assetsSizeBytes], ['Resources', packaging.resourcesSizeBytes], ['Other files', packaging.otherSizeBytes]]
    : ios ? [['Application payload', ios.archiveSizeBreakdown.payloadAppSizeBytes], ['Embedded frameworks (within payload)', ios.archiveSizeBreakdown.frameworksSizeBytes]] : [];
  const uncompressed = packaging?.uncompressedSizeBytes ?? ios?.archiveSizeBreakdown.uncompressedSizeBytes ?? 0;
  const largeFiles = packaging?.largeFiles ?? ios?.archiveSizeBreakdown.largeFiles ?? [];
  return <div className="report-view"><div className="section-heading"><div><p className="eyebrow">EXTRACTED FROM THIS ARCHIVE</p><h2>Build details</h2><p>Configuration facts to help you reproduce and resolve findings. Unknown values are not filled with guessed defaults.</p></div></div><div className="detail-grid masonry-details">
    <DetailCard title="Application identity"><Facts rows={[
      ['App name', app.name], ['Package / bundle identifier', app.identifier], ['Version / build', `${app.version} / ${app.build}`], ['Detected format', `${summary.artifact.platform === 'android' ? 'Android' : 'iOS / iPadOS'} · ${summary.artifact.artifactType.toUpperCase()}`], ['Uploaded filename', summary.artifact.fileName], ['Archive size', size(summary.artifact.sizeBytes)],
      ...(android ? [['App name source', android.appLabelSource ?? 'Not recorded'] as [string, ReactNode]] : []),
    ]}/></DetailCard>
    <DetailCard title="OS & release configuration" icon="chip">{android ? <Facts rows={[
      ['Minimum Android SDK', android.minSdkVersion ?? 'Not declared'], ['Target Android SDK', android.targetSdkVersion ?? 'Not declared'], ['Maximum SDK', android.maxSdkVersionDeclared ? android.maxSdkVersion : 'Not declared'],
      ['Debuggable', `${yesNo(android.debuggable.value)} · ${android.debuggable.isExplicit ? 'explicit declaration' : 'resolved default'}`], ['Test-only', `${yesNo(android.testOnly.value)} · ${android.testOnly.isExplicit ? 'explicit declaration' : 'resolved default'}`],
      ['Profileable by shell', yesNo(android.profiling?.profileableByShell)], ['Native ABIs', android.nativeLibraries.abis.join(', ') || 'None identified'],
    ]}/> : ios ? <Facts rows={[
      ['Minimum OS', ios.minimumOsVersion || 'Not declared'], ['Declared devices', ios.declaredDeviceFamilies.join(', ') || 'Not declared'], ['Architectures', ios.architectures.join(', ') || 'Not established'],
      ['Build SDK', ios.buildSdkMetadata.sdkName || 'Not extracted'], ['SDK build', ios.buildSdkMetadata.sdkBuild || 'Not extracted'], ['Xcode build metadata', ios.buildSdkMetadata.xcodeVersion || 'Not extracted'], ['Platform version', ios.buildSdkMetadata.platformVersion || 'Not extracted'],
    ]}/> : null}<p className="field-note">The build SDK, target SDK and minimum supported OS describe different things. Declared support still requires device testing.</p></DetailCard>
    <SigningDetails summary={summary}/>
    <DetailCard title="Package footprint" description="Archive size is different from a generated device download."><Facts rows={[
      ['Uploaded archive', size(summary.artifact.sizeBytes)], ['Uncompressed entries', size(uncompressed)], ['Estimated device download', packaging?.estimatedDownloadSizeBytes !== undefined ? size(packaging.estimatedDownloadSizeBytes) : 'Not calculated'],
    ]}/><div className="footprint-list">{categories.map(([label, bytes]) => <div key={label}><span>{label}</span><strong>{size(bytes)}</strong><meter min={0} max={Math.max(uncompressed, 1)} value={bytes} aria-label={label}/></div>)}</div>{largeFiles.length > 0 && <details className="raw-details"><summary>Largest flagged files ({largeFiles.length})</summary><ul className="file-list">{largeFiles.slice(0, 15).map(file => <li key={file.path}><code>{file.path}</code><span>{size(file.sizeBytes)}</span></li>)}</ul></details>}</DetailCard>
    {android && <><DetailCard title="Permissions & transport" icon="shield"><Facts rows={[
      ['Declared permissions', android.permissions.declared.length], ['Sensitive permissions', android.permissions.sensitivePermissions.length], ['Special approval declarations', android.permissions.requiresSpecialApproval.length], ['Cleartext traffic allowed', yesNo(android.security.usesCleartextTraffic)], ['Network security configuration present', yesNo(android.security.networkSecurityConfigPresent)],
    ]}/><div className="tag-list">{android.permissions.declared.map(permission => <code key={permission}>{permission}</code>)}</div>{!android.permissions.declared.length && <p className="field-note">No permissions were extracted from the manifest.</p>}<p className="field-note">Declared permissions do not establish actual data collection. Transport overrides and SDK behavior require separate review.</p></DetailCard>
    <DetailCard title="Device & component declarations"><div className="table-scroll"><table><caption>Exported components</caption><thead><tr><th>Component</th><th>Type</th><th>Required permission</th></tr></thead><tbody>{android.security.exportedComponents.map((component, index) => <tr key={`${component.name}-${index}`}><td><code>{component.name}</code></td><td>{component.type}</td><td>{component.permissionRequired || 'None declared'}</td></tr>)}</tbody></table></div>{!android.security.exportedComponents.length && <p className="field-note">No exported components were recorded.</p>}<h4>Declared hardware / software features</h4><ul className="file-list">{android.hardwareFeatures.map(feature => <li key={feature.name}><code>{feature.name}</code><span>{feature.required ? 'Required' : 'Optional'}</span></li>)}</ul></DetailCard></>}
    {ios && <IosPrivacyDetails metadata={ios}/>}
    <DetailCard title="Inspection provenance" description="Use these details to compare scans of rebuilt artifacts."><Facts rows={[
      ['Scan identifier', summary.scanId], ['Started', new Date(summary.startedAt).toLocaleString()], ['Finished', new Date(summary.completedAt).toLocaleString()], ['Inspection duration', `${(summary.elapsedMs / 1000).toFixed(2)} seconds`],
      ['Rules evaluated', Object.keys(summary.assessment.ruleRevisionsUsed).length], ['Checks not applicable', summary.assessment.notApplicableCount],
    ]}/><details className="raw-details"><summary>Tool versions and rule revisions</summary><pre>{JSON.stringify({ toolVersions: summary.assessment.toolVersionsUsed, ruleRevisions: summary.assessment.ruleRevisionsUsed }, null, 2)}</pre></details><p className="field-note">Tool versions list detected tools with version data; they are not a guarantee that every possible tool check executed. Read individual outcomes.</p></DetailCard>
  </div></div>;
}

export function IosPrivacyDetails({ metadata }: { metadata: IosMetadata }) {
  return <><DetailCard title="Privacy & transport declarations" icon="shield"><Facts rows={[
    ['Privacy manifest present', yesNo(metadata.privacyManifest.present)], ['Manifest syntax valid', metadata.privacyManifest.present ? yesNo(metadata.privacyManifest.syntaxValid) : 'Not applicable'], ['Tracking declared', metadata.privacyManifest.details ? yesNo(metadata.privacyManifest.details.trackingEnabled) : 'Not established'], ['Allows arbitrary network loads', yesNo(metadata.transportSecurity.allowsArbitraryLoads)], ['ATS exception domains', metadata.transportSecurity.exceptionDomains.join(', ') || 'None extracted'],
  ]}/><h4>Permission purpose strings</h4><dl className="purpose-strings">{Object.entries(metadata.purposeStrings).map(([key, value]) => <div key={key}><dt><code>{key}</code></dt><dd>{value}</dd></div>)}</dl>{!Object.keys(metadata.purposeStrings).length && <p className="field-note">No purpose strings extracted. This does not prove the app never requests a protected capability.</p>}<p className="field-note">Privacy syntax and declared text are not an audit of runtime collection or complete API usage.</p></DetailCard>
    <DetailCard title="Embedded code & privacy inventory" icon="chip"><Facts rows={[
      ['Embedded frameworks', metadata.embeddedFrameworks.length], ['App extensions', metadata.embeddedExtensions.length], ['Required-reason API declarations', metadata.privacyManifest.details?.accessedApiTypes?.length ?? 'Not extracted'], ['Collected data declarations', metadata.privacyManifest.details?.collectedDataTypes?.length ?? 'Not extracted'],
    ]}/><ul className="file-list">{[...metadata.embeddedFrameworks, ...metadata.embeddedExtensions].map((name, index) => <li key={`${name}-${index}`}><code>{name}</code></li>)}</ul>{metadata.privacyManifest.details && <details className="raw-details"><summary>View parsed privacy declarations</summary><pre>{JSON.stringify(metadata.privacyManifest.details, null, 2)}</pre></details>}</DetailCard></>;
}

export function IosDiagnostics({ summary }: { summary: ScanSummary }) {
  const metadata = summary.metadata.ios;
  if (!metadata) return null;
  return <div className="report-view"><div className="section-heading"><div><p className="eyebrow">IOS / IPADOS</p><h2>iOS diagnostics</h2><p>Signing, SDK and privacy evidence from the exported IPA. Device behavior and store eligibility still need validation.</p></div></div><PermissionUsagePanel audit={metadata.permissionUsage}/><div className="detail-grid masonry-details"><SigningDetails summary={summary}/><DetailCard title="Runtime & toolchain"><Facts rows={[
    ['Minimum supported OS', metadata.minimumOsVersion || 'Not extracted'], ['Build SDK', metadata.buildSdkMetadata.sdkName || 'Not extracted'], ['Xcode metadata', metadata.buildSdkMetadata.xcodeVersion || 'Not extracted'], ['Architectures', metadata.architectures.join(', ') || 'Not established'], ['Supported devices', metadata.declaredDeviceFamilies.join(', ') || 'Not declared'], ['Runtime tests', 'Not performed'],
  ]}/><p className="field-note">No simulator/device session was run. Installation, permission prompts, crash behavior and iPad layouts are not validated by these declarations.</p></DetailCard><IosPrivacyDetails metadata={metadata}/></div></div>;
}
