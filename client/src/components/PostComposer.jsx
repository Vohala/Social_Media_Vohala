import { useState } from 'react'
import { api } from '../api'

export default function PostComposer({ onCreated }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('text', text)
      if (file) fd.append('image', file)
      const post = await api('/api/posts', { method: 'POST', formData: fd })
      setText('')
      setFile(null)
      onCreated?.(post)
    } catch (e) {
      alert('Failed: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="card mb-4" onSubmit={submit}>
      <div className="font-semibold mb-2">Share something with Vohala</div>
      <textarea className="input" placeholder="What's happening?" value={text} onChange={e=>setText(e.target.value)} />
      <div className="flex items-center gap-2 mt-2">
        <input type="file" accept="image/*" onChange={e=>setFile(e.target.files[0])} />
        <button className="btn btn-primary" disabled={loading}>{loading ? 'Posting...' : 'Post'}</button>
        <span className="badge">Image optional</span>
      </div>
    </form>
  )
}
