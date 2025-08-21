import { useState } from "react";
import axios from "axios";

export default function Search() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);

  const search = async () => {
    const res = await axios.get(`/api/users/search?q=${q}`);
    setResults(res.data);
  };

  return (
    <div className="p-4">
      <input value={q} onChange={e => setQ(e.target.value)} className="border p-2" />
      <button onClick={search} className="bg-vohala text-white px-3 py-1 ml-2">Search</button>
      <ul>
        {results.map(u => (
          <li key={u._id} className="flex justify-between p-2">
            {u.username}
            <button className="bg-vohala px-2 py-1 text-white rounded">Follow</button>
          </li>
        ))}
      </ul>
    </div>
  );
}