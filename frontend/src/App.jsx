import React, { useState } from "react";

const App = () => {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [format, setFormat] = useState('pdf');
  const [converting, setConverting] = useState(false);
  const [success, setSuccess] = useState(false);
  const MAX_FILES = 20;

  const handleDrop = (e) => {
    e.preventDefault();
    setError("");
    const droppedFiles = Array.from(e.dataTransfer.files);

    if (droppedFiles.length > MAX_FILES) {
      setError(`Limit reached! Max ${MAX_FILES} files allowed.`);
      return;
    }

    setFiles(droppedFiles);
  };

  const handleBrowse = (e) => {
    setError("");

    const selectedFiles = Array.from(e.target.files);

    if (selectedFiles.length > MAX_FILES) {
      setError(`Limit reached! Max ${MAX_FILES} files allowed.`);
      return;
    }

    setFiles(selectedFiles);
  };

  const reset = () => {
    setFiles([]);
    setError("");
    setSuccess(false);
  };

  // Convert Button Function (POST -> parse JSON -> fetch download)
  const handleConvert = async () => {
    if (files.length === 0) {
      setError("No files selected");
      return;
    }

    setConverting(true);
    setError("");
    setSuccess(false);

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("format", format);

    try {
      const res = await fetch("http://localhost:5000/convert", {
        method: "POST",
        body: formData,
      });

      const contentType = (res.headers.get('content-type') || '').toLowerCase();

      // If the server sent JSON (error message), parse that and show it
      if (contentType.includes('application/json')) {
        const data = await res.json();
        setError(data?.message || 'Conversion failed');
        setConverting(false);
        return;
      }

      if (!res.ok) {
        setError('Conversion failed');
        setConverting(false);
        return;
      }

      // otherwise treat response as a zip blob
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `converted-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      setConverting(false);
      setSuccess(true);
      setFiles([]);

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError('Conversion error');
      setConverting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow p-6">
        <h1 className="text-2xl font-bold text-center mb-4">File Converter</h1>

        {files.length === 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-400 rounded-xl p-10 text-center cursor-pointer hover:border-blue-500 transition"
          >
            <p className="text-gray-600 mb-3">Drag & drop files (max 20)</p>
            <p className="text-sm text-gray-500">OR</p>
            <label className="mt-3 inline-block bg-blue-500 text-white py-2 px-4 rounded-lg cursor-pointer">
              Browse Files
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleBrowse}
              />
            </label>
          </div>
        )}

        {error && <p className="text-red-500 text-center mt-3">{error}</p>}

        {success && <p className="text-green-500 text-center mt-3 font-semibold"> Convert and Download Successful!</p>}

        {converting && (
          <div className="mt-4 w-full">
            <p className="text-center text-gray-600 mb-2">Converting...</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full animate-pulse"
                style={{ width: '100%' }}
              ></div>
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-5 flex gap-6">
            <div className="w-1/2">
              <h2 className="text-lg font-semibold mb-3">Selected Files:</h2>
              <ul className="list-disc pl-6 space-y-1">
                {files.map((file, idx) => (
                  <li key={idx}>{file.name}</li>
                ))}
              </ul>
            </div>

            <div className="w-1/2 bg-gray-50 p-4 rounded-xl shadow">
              <h2 className="text-lg font-semibold mb-3">Convert To:</h2>

              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full border rounded-lg p-2 mb-4"
              >
                <option value="pdf">PDF</option>
                <option value="jpg">JPG</option>
                <option value="png">PNG</option>
                <option value="webp">WebP</option>
                <option value="docx">DOCX</option>
              </select>
              <button
                onClick={handleConvert}
                className="
    px-6 py-3
    bg-blue-500 text-white font-wsemibold rounded-lg shadow-md
    transition-all duration-300 ease-in-out
    hover:bg-white hover:text-blue-500 hover:scale-105 hover:shadow-xl
    active:scale-95 active:bg-gray-100 active:shadow-inner
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75
"
              >
                Convert All to {format.toUpperCase()}
              </button>

              <button
                onClick={reset}
                className="
    px-6 py-3
    bg-red-500 text-white font-semibold rounded-lg shadow-md
    transition-all duration-300 ease-in-out
    hover:bg-white hover:text-blue-500 hover:scale-105 hover:shadow-xl
    active:scale-95 active:bg-gray-100 active:shadow-inner
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75
"
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
