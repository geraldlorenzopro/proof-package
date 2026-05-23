import { useState } from 'react';
import { EvidenceForm } from '@/components/EvidenceForm';
import type { EvidenceItem, DatePrecision } from '@/types/evidence';

export default function TestDatePicker() {
  const mk = (precision: DatePrecision, n: number): EvidenceItem => ({
    id: `t-${precision}`,
    file: new File([''], 'mock.jpg', { type: 'image/jpeg' }),
    previewUrl: '',
    type: 'photo',
    exhibit_number: String(n),
    event_date: precision === 'exact' ? '2024-02-14' : precision === 'month' ? '2022-03-01' : '2018-01-01',
    date_is_approximate: precision !== 'exact',
    date_precision: precision,
    caption: '',
    participants: 'María y Juan',
    formComplete: false,
  });
  const [items, setItems] = useState<EvidenceItem[]>([mk('exact', 1), mk('month', 2), mk('year', 3)]);
  return (
    <div className="p-2 space-y-6 bg-background min-h-screen">
      {items.map((it, i) => (
        <div key={it.id} className="border border-border rounded p-2">
          <div className="text-xs font-bold mb-2 text-foreground">Mode: {it.date_precision}</div>
          <EvidenceForm
            item={it}
            lang="es"
            onChange={(u) => setItems((prev) => prev.map((p, idx) => (idx === i ? u : p)))}
          />
        </div>
      ))}
    </div>
  );
}
