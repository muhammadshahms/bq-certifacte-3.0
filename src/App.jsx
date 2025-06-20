import React, { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import debounce from 'lodash/debounce';

function App() {
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  // Load students from Excel
  useEffect(() => {
    fetch('/data/students.xlsx')
      .then(res => res.arrayBuffer())
      .then(data => {
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        setStudents(jsonData);
      });
  }, []);

  // Debounced suggestion search
  const handleSearch = useMemo(() => debounce((value) => {
    const trimmed = value.trim().toLowerCase();

    if (!trimmed) {
      setSuggestions([]);
      setSelected(null);
      return;
    }

    const matched = students.filter(
      s =>
        s.StudentId.toString().includes(trimmed) ||
        s['Student Name']?.toLowerCase().includes(trimmed)
    ).slice(0, 5);

    setSuggestions(matched);

    const exactMatch = matched.find(
      s =>
        s.StudentId.toString() === trimmed ||
        s['Student Name']?.toLowerCase().replace(/\s+/g, '') === trimmed.replace(/\s+/g, '')
    );

    setSelected(exactMatch || null);
  }, 300), [students]);

  useEffect(() => {
    handleSearch(query);
  }, [query, handleSearch]);

  // Shared PDF generator logic
  const createPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 100],
    });

    const pageWidth = 80;
    const centerText = (text, y) => {
      const textWidth = doc.getTextWidth(text);
      const x = (pageWidth - textWidth) / 2;
      doc.text(text, x, y);
    };

    let y = 10;
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    centerText('Bano Qabil 3.0', y); y += 5;
    centerText('Graduation Ceremony', y); y += 6;

    doc.setFont('courier', 'normal');
    doc.line(5, y, 75, y); y += 4;

    centerText(`Student ID: ${selected.StudentId}`, y); y += 5;
    centerText(`Name: ${selected['Student Name']}`, y); y += 5;
    centerText(`Serial No: S-${selected.SNo}`, y); y += 6;

    doc.line(5, y, 75, y); y += 4;

    doc.setFont('courier', 'italic');
    centerText('Please keep this token safe.', y); y += 4;
    centerText('It is required to collect', y); y += 4;
    centerText('your certificate.', y); y += 6;

    doc.setFont('courier', 'bold');
    centerText('Thanks for being part of', y); y += 4;
    centerText('Bano Qabil 3.0!', y); y += 2;

    return doc;
  };

  const handleDownload = () => {
    if (!selected) return;
    const doc = createPDF();
    doc.save(`voucher_${selected.StudentId}.pdf`);
  };

  const handlePrint = () => {
    if (!selected) return;
    const doc = createPDF();
    const blobUrl = doc.output('bloburl');
    const win = window.open(blobUrl, '_blank');
    win?.print();
  };

  return (
    <div className="min-h-screen bg-blue-50 p-6 font-sans">
      <div className="max-w-xl mx-auto bg-white shadow-xl rounded-xl p-6 relative">
        <h1 className="text-3xl font-bold text-center text-blue-800 mb-6">Student Voucher Generator</h1>

        {/* Input Field */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Enter Student ID or Name"
            className="border border-gray-300 p-3 w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => {
                setQuery('');
                setSelected(null);
                setSuggestions([]);
              }}
            >
              ✖
            </button>
          )}

          {/* Suggestion Dropdown */}
          {suggestions.length > 0 && (
            <ul className="absolute z-10 bg-white border border-gray-300 rounded-lg mt-1 w-full max-h-48 overflow-y-auto shadow text-sm">
              {suggestions.map((s, index) => (
                <li
                  key={index}
                  className="px-3 py-2 hover:bg-blue-100 cursor-pointer"
                  onClick={() => {
                    setSelected(s);
                    setSuggestions([]);
                    setQuery(s.StudentId);
                  }}
                >
                  {s.StudentId} — {s['Student Name']}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Result */}
        {selected ? (
          <div className="bg-blue-50 border border-blue-300 p-4 rounded-lg shadow-sm text-sm">
            <p><strong>Name:</strong> {selected['Student Name']}</p>
            <p><strong>Student ID:</strong> {selected.StudentId}</p>
            <p><strong>Serial No:</strong> S-{selected.SNo}</p>

            {/* Buttons */}
            <button
              className="mt-3 bg-green-600 hover:bg-green-700 text-white px-4 py-2 w-full rounded-lg text-sm font-semibold"
              onClick={handleDownload}
            >
              Download Voucher
            </button>

            <button
              className="mt-2 bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 w-full rounded-lg text-sm font-semibold"
              onClick={handlePrint}
            >
              Print Voucher (Thermal)
            </button>
          </div>
        ) : query.trim() && (
          <div className="text-center text-red-500 text-sm">
            No student found with given ID or Name
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
