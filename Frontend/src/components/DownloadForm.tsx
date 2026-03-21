import { useState } from "react";

type Props = {
  onStart: (urls: string[]) => void;
};

export default function DownloadForm({ onStart }: Props) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    const urls = input
      .split("\n")
      .map((url) => url.trim())
      .filter(Boolean);

    if (urls.length > 0) {
      onStart(urls);
      setInput("");
    }
  };

  return (
    <div className="bg-white shadow rounded-xl p-4">
      <textarea
        className="w-full border p-2 rounded-lg h-32"
        placeholder="Paste YouTube URLs (one per line)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <button
        onClick={handleSubmit}
        className="mt-3 bg-blue-600 text-white px-6 py-2 rounded-lg"
      >
        Start Download
      </button>
    </div>
  );
}