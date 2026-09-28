import { useState } from "react";
import Papa from "papaparse";
import { UploadCloud } from "lucide-react";
import Modal from "../../../marketing-lib/Modal.jsx";
import api from "../../../services/marketingApi.js";
import { useToast } from "../../../marketing-lib/useToast.js";
import { STAGES } from "../../../marketing-lib/constants.js";

const HEADER_MAP = {
  "client type": "clientType",
  "site name": "siteName",
  location: "location",
  "contact person": "contactPerson",
  "contact no": "contactNo",
  "contact no.": "contactNo",
  "lead head": "leadHead",
  "was the catalogue given to the client/site": "catalogue",
  "mode of communication": "modeComm",
  stage: "stage",
  "remarks for the step": "remarks",
  "final emails": "email",
  email: "email",
  timestamp: "timestamp",
};

function normalizeRow(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const mapped = HEADER_MAP[key.trim().toLowerCase()];
    if (mapped) out[mapped] = String(value ?? "").trim();
  }
  const totalKey = Object.keys(raw).find((k) => k.toLowerCase().includes("total"));
  if (totalKey) out.totalNo = String(raw[totalKey] ?? "").trim();
  if (!out.stage || !STAGES.includes(out.stage)) out.stage = STAGES[0];
  return out;
}

export default function ImportModal({ open, onClose, onImported }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const { push } = useToast();

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.map(normalizeRow).filter((r) => r.siteName);
        setRows(parsed);
        if (!parsed.length) push("No valid rows found (need at least a Site Name column).", "error");
      },
      error: () => push("Failed to parse CSV.", "error"),
    });
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    try {
      const res = await api.post("/leads/import", { rows });
      push(`Imported ${res.data.count} lead(s).`, "success");
      setRows([]);
      setFileName("");
      onImported();
    } catch (err) {
      push(err.response?.data?.msg || "Import failed.", "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Import Leads (CSV)" wide>
      <div className="space-y-4">
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-8 cursor-pointer hover:border-brand transition-colors">
          <UploadCloud size={28} className="text-gray-400" />
          <span className="text-sm text-gray-500">{fileName || "Click to choose a CSV file"}</span>
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>

        {rows.length > 0 && (
          <>
            <p className="text-sm text-gray-600">
              <strong>{rows.length}</strong> row(s) ready to import.
            </p>
            <div className="max-h-64 overflow-auto border border-gray-100 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Site</th>
                    <th className="p-2 text-left">Client Type</th>
                    <th className="p-2 text-left">Contact</th>
                    <th className="p-2 text-left">Lead Head</th>
                    <th className="p-2 text-left">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="p-2">{r.siteName}</td>
                      <td className="p-2">{r.clientType || "—"}</td>
                      <td className="p-2">{r.contactPerson || "—"}</td>
                      <td className="p-2">{r.leadHead || "—"}</td>
                      <td className="p-2">{r.stage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={!rows.length || importing} className="btn-primary" onClick={handleImport}>
            {importing ? "Importing..." : `Import ${rows.length || ""} Lead(s)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
