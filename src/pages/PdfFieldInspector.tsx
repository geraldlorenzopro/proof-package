import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";

interface FieldInfo {
  name: string;
  type: string;
  value: string;
}

export default function PdfFieldInspector() {
  const [fields1, setFields1] = useState<FieldInfo[]>([]);
  const [fields2, setFields2] = useState<FieldInfo[]>([]);
  const [error1, setError1] = useState("");
  const [error2, setError2] = useState("");

  useEffect(() => {
    async function inspect(url: string, setFields: (f: FieldInfo[]) => void, setError: (e: string) => void) {
      try {
        const bytes = await fetch(url).then(r => r.arrayBuffer());
        let pdf: PDFDocument;
        try {
          pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
        } catch {
          pdf = await PDFDocument.load(bytes);
        }
        const form = pdf.getForm();
        const allFields = form.getFields();
        const infos: FieldInfo[] = allFields.map(f => {
          let value = "";
          try {
            const constructor = f.constructor.name;
            if (constructor === "PDFTextField") {
              value = (f as any).getText() || "";
            } else if (constructor === "PDFCheckBox") {
              value = (f as any).isChecked() ? "checked" : "unchecked";
            } else if (constructor === "PDFDropdown") {
              value = (f as any).getSelected()?.join(", ") || "";
            } else if (constructor === "PDFRadioGroup") {
              value = (f as any).getSelected() || "";
            }
          } catch {}
          return { name: f.getName(), type: f.constructor.name, value };
        });
        setFields(infos);
      } catch (e: any) {
        setError(e.message);
      }
    }

    inspect("/forms/Gerald_L_s_I-765.pdf", setFields1, setError1);
    inspect("/forms/i-765_2-2.pdf", setFields2, setError2);
  }, []);

  const renderTable = (fields: FieldInfo[], error: string, title: string) => (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      {error && <p className="text-red-500">Error: {error}</p>}
      <p className="mb-2">Total fields: {fields.length}</p>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr><th className="border p-1 text-left">Name</th><th className="border p-1 text-left">Type</th><th className="border p-1 text-left">Value</th></tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={i}><td className="border p-1 font-mono">{f.name}</td><td className="border p-1">{f.type}</td><td className="border p-1">{f.value}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">PDF AcroForm Field Inspector</h1>
      {renderTable(fields1, error1, "Gerald_L_s_I-765.pdf (Docketwise filled)")}
      {renderTable(fields2, error2, "i-765_2-2.pdf (blank)")}
    </div>
  );
}
