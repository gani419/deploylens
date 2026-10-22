import { useState } from 'react';
import type { Finding } from '@deploylens/contracts';
import { researchDescription } from '@deploylens/reporting';
import { Icon } from './Icon.js';

export function ResearchIssue({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false), [message, setMessage] = useState('');
  const [draft, setDraft] = useState(() => researchDescription(finding));
  async function copy() {
    try { await navigator.clipboard.writeText(draft); setMessage('Copied. Paste into your chosen community or AI assistant, then review before posting.'); }
    catch { setMessage('Clipboard is unavailable. Select the draft text and copy it manually.'); }
  }
  return <div className="research-issue"><button className="secondary small" aria-expanded={open} onClick={() => setOpen(value => !value)}><Icon name="search"/>Research this issue</button>{open && <section className="research-content"><h4>Ask for help with context</h4><p className="field-note">A Markdown draft suitable for GitHub Issues, Stack Overflow, Reddit or an AI assistant. Add a minimal reproduction and remove private information. DeployLens does not post anything.</p><label className="form-field">Issue description<textarea rows={16} value={draft} onChange={event => setDraft(event.target.value)}/></label><div className="action-row"><button className="primary" onClick={copy}>Copy issue description</button><a className="secondary" href="https://stackoverflow.com/questions/ask" target="_blank" rel="noreferrer">Stack Overflow</a><a className="secondary" href="https://www.reddit.com/submit" target="_blank" rel="noreferrer">Reddit</a><a className="secondary" href="https://github.com/issues" target="_blank" rel="noreferrer">GitHub Issues</a><a className="secondary" href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT</a><a className="secondary" href="https://claude.ai/new" target="_blank" rel="noreferrer">Claude</a></div><p className="clipboard-notice" role="status">{message}</p></section>}</div>;
}
