const paths: Record<string, string> = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  upload: 'M12 16V3 M7 8l5-5 5 5 M4 16v5h16v-5',
  findings: 'M12 3l10 18H2L12 3z M12 9v5 M12 17v1',
  checks: 'M9 5h12 M9 12h12 M9 19h12 M2 5l2 2 3-4 M2 12l2 2 3-4 M2 19l2 2 3-4',
  details: 'M4 3h16v18H4z M8 7h8 M8 12h8 M8 17h5',
  chip: 'M6 6h12v12H6z M9 9h6v6H9z M9 2v4 M15 2v4 M9 18v4 M15 18v4 M2 9h4 M2 15h4 M18 9h4 M18 15h4',
  store: 'M3 9l2-6h14l2 6 M3 9v3h18V9 M5 12v9h14v-9 M9 21v-6h6v6',
  shield: 'M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4z M8 12l3 3 5-6',
  book: 'M12 5v17 M12 5C8 2 4 2 2 3v16c4-1 7 0 10 3 3-3 6-4 10-3V3c-2-1-6-1-10 2z',
  moon: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11z',
  sun: 'M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  close: 'M5 5l14 14 M19 5L5 19',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4',
  search: 'M16 16l6 6 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  check: 'M4 12l5 5L20 6',
  info: 'M12 10v7 M12 6v1 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  chevron: 'M9 5l7 7-7 7',
  copy: 'M8 8h13v13H8z M16 8V3H3v13h5',
};
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <svg className={`icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.info}/></svg>;
}
