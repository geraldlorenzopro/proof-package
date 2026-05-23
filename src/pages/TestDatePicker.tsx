import { useState } from 'react';
import { EvidenceForm } from '@/components/EvidenceForm';
import type { EvidenceItem } from '@/types/evidence';

export default function TestDatePicker() {
  const mk = (precision: 'exact'|'month'|'year'): EvidenceItem => ({
    id: `t-${precision}`,
    file: null as any,
    fileName: 'mock.jpg',
    fileType: 'image/jpeg',
    preview: '',
    type: 'photo',
    participants: 'María y Juan',
    caption: '',
    event_date: precision === 'exact' ? '2024-02-14' : precision === 'month' ? '2022-03-01' : '2018-01-01',
    date_is_approximate: precision !== 'exact',
    date_precision: precision,
    location: '',
  } as any);
  const [items, setItems] = useState([mk('exact'), mk('month'), mk('year')]);
  return (
    <div className="p-2 space-y-6 bg-background min-h-screen">
      {items.map((it, i) => (
        <div key={it.id} className="border border-border rounded p-2">
          <div className="text-xs font-bold mb-2">Mode: {it.date_precision}</div>
          <EvidenceForm
            item={it}
            lang="es"
            onChange={(u) => setItems((prev) => prev.map((p, idx) => idx === i ? u : p))}
          />
        </div>
      ))}
    </div>
  );
}
