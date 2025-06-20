import React, { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import debounce from 'lodash/debounce';

function App() {
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [printLogs, setPrintLogs] = useState([]);
  const [mongoLogs, setMongoLogs] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState({
    totalStudents: 0,
    presentCount: 0,
    absentCount: 0
  });
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchRef = useRef();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSuggestions([]);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  // Load students from Excel
  useEffect(() => {
    fetch('/data/students.xlsx')
      .then(res => res.arrayBuffer())
      .then(data => {
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        setStudents(jsonData);
        // Update total students count
        setAttendanceStats(prev => ({ ...prev, totalStudents: jsonData.length }));
      });
  }, []);

  // Search with debounce
  const handleSearch = useMemo(() => debounce((value) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return setSelected(null);

    const matched = students.filter(s => (
      s.StudentId.toString().includes(trimmed) ||
      s['Student Name']?.toLowerCase().includes(trimmed)
    )).slice(0, 5);

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
  }, [query]);

  // PDF Builder
  const createPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: [80, 100] });
    const center = (text, y) => {
      const w = doc.getTextWidth(text);
      doc.text(text, (80 - w) / 2, y);
    };
    let y = 10;
    doc.setFont('courier', 'bold'); doc.setFontSize(10);
    center('Bano Qabil 3.0', y); y += 5;
    center('Graduation Ceremony', y); y += 6;
    doc.setFont('courier', 'normal'); doc.line(5, y, 75, y); y += 4;
    center(`Student ID: ${selected.StudentId}`, y); y += 5;
    center(`Name: ${selected['Student Name']}`, y); y += 5;
    center(`Serial No: S-${selected.SNo}`, y); y += 6;
    doc.line(5, y, 75, y); y += 4;
    doc.setFont('courier', 'italic');
    center('Please keep this token safe.', y); y += 4;
    center('It is required to collect', y); y += 4;
    center('your certificate.', y); y += 6;
    doc.setFont('courier', 'bold');
    center('Thanks for being part of', y); y += 4;
    center('Bano Qabil 3.0!', y);
    return doc;
  };

  const logPrint = (type) => {
    const newLog = {
      Timestamp: new Date().toLocaleString(),
      StudentID: selected.StudentId,
      Name: selected['Student Name'],
      Serial: `S-${selected.SNo}`,
      Method: type,
    };
    setPrintLogs(prev => [...prev, newLog]);
  };

  const markAttendance = async () => {
    if (!selected) return;

    try {
      await axios.post('http://localhost:3001/mark-attendance', {
        studentId: selected.StudentId,
        name: selected['Student Name']
      });
      fetchAttendanceStats();
      fetchAttendanceLogs();
      alert('Attendance marked successfully');
    } catch (error) {
      alert('Error marking attendance');
    }
  };

  const handleDownload = () => {
    if (!selected) return;
    createPDF().save(`voucher_${selected.StudentId}.pdf`);
    logPrint('Download');
  };

  const handlePrint = () => {
    if (!selected) return;
    const blobUrl = createPDF().output('bloburl');
    const win = window.open(blobUrl, '_blank');
    win?.print();
    logPrint('Thermal');
  };
  const syncWithMongo = () => {
    axios.post('http://localhost:3001/save-log', { logs: printLogs })
      .then(() => {
        alert('Synced with MongoDB');
        setPrintLogs([]);
        fetchMongoLogs();
      })
      .catch(() => alert('Error syncing'));
  };

  const fetchMongoLogs = () => {
    axios.get('http://localhost:3001/logs')
      .then(res => setMongoLogs(res.data));
  };

  const fetchAttendanceStats = () => {
    axios.get('http://localhost:3001/attendance-stats')
      .then(res => setAttendanceStats(res.data));
  };

  const fetchAttendanceLogs = () => {
    axios.get('http://localhost:3001/attendance-logs')
      .then(res => setAttendanceLogs(res.data));
  };

  useEffect(() => {
    fetchMongoLogs();
    fetchAttendanceStats();
    fetchAttendanceLogs();
  }, []);

  return (
    <div className="min-h-screen bg-blue-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Dashboard Header */}
        <div className="bg-white shadow-xl rounded-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-center text-blue-800 mb-6">🎓 Student Attendance System</h1>

          {/* Attendance Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-100 p-4 rounded-lg text-center">
              <h3 className="text-lg font-semibold text-green-800">Present</h3>
              <p className="text-3xl font-bold text-green-600">{mongoLogs.length}</p>
            </div>

            <div className="bg-blue-100 p-4 rounded-lg text-center">
              <h3 className="text-lg font-semibold text-blue-800">Total Students</h3>
              <p className="text-3xl font-bold text-blue-600">{attendanceStats.totalStudents}</p>
            </div>
          </div>

          {/* Search and Voucher Section */}
          {/* Search and Voucher Section */}
          <div className="relative mb-4" ref={searchRef}>
            <input
              type="text"
              placeholder="Enter Student ID or Name"
              className="border border-gray-300 p-3 w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightedIndex(-1);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                  const selectedSuggestion = suggestions[highlightedIndex];
                  setQuery(selectedSuggestion.StudentId.toString());
                  setSelected(selectedSuggestion);
                  setSuggestions([]);
                  setHighlightedIndex(-1);
                }
              }}
            />
            {query && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setQuery('');
                  setSelected(null);
                  setSuggestions([]);
                  setHighlightedIndex(-1);
                }}
              >
                ✖
              </button>
            )}

            {suggestions.length > 0 && (
              <ul className="absolute z-10 bg-white border border-gray-300 rounded-lg mt-1 w-full max-h-48 overflow-y-auto shadow text-sm">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    className={`px-3 py-2 cursor-pointer ${highlightedIndex === i ? 'bg-blue-100' : 'hover:bg-blue-50'
                      }`}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    onClick={() => {
                      setQuery(s.StudentId.toString());
                      setSelected(s);
                      setSuggestions([]);
                      setHighlightedIndex(-1);
                    }}
                  >
                    {s.StudentId} — {s['Student Name']}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected && (
            <div className="bg-blue-50 border border-blue-300 p-4 rounded-lg shadow-sm text-sm mb-4">
              <p><strong>Name:</strong> {selected['Student Name']}</p>
              <p><strong>Student ID:</strong> {selected.StudentId}</p>
              <p><strong>Serial No:</strong> S-{selected.SNo}</p>

              <div className="flex items-center gap-2 mt-3">

                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                  onClick={handleDownload}
                >Download Voucher</button>

                <button
                  className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold col-span-2"
                  onClick={handlePrint}
                >Print Voucher (Thermal)</button>
              </div>
            </div>
          )}

          {printLogs.length > 0 && (
            <button
              className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 w-full rounded-lg text-sm font-semibold"
              onClick={syncWithMongo}
            >
              Sync Data
            </button>
          )}
        </div>

        {/* Logs Section */}
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-3">Attendance Log</h2>
            <div className="max-h-64 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left">S.No</th>
                    <th className="px-2 py-2 text-left">Student ID</th>
                    <th className="px-2 py-2 text-left">Name</th>
                    <th className="px-2 py-2 text-left">Method</th>
                    <th className="px-2 py-2 text-left">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mongoLogs.map((log, i) => (
                    <tr key={i}>
                      <td className="px-2 py-2">{i + 1}</td> {/* Serial number */}
                      <td className="px-2 py-2">{log.StudentID}</td>
                      <td className="px-2 py-2">{log.Name}</td>
                      <td className="px-2 py-2">{log.Method}</td>
                      <td className="px-2 py-2">{log.Timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;