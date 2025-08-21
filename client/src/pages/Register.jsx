import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await api('/api/auth/register', { method: 'POST', body: { name, email, password } })
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      nav('/')
    } catch (e) {
      alert('Register failed: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto card mt-10">
      <h1 className="text-2xl font-bold mb-4">Join Vohala</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="input" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
        <input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Password (min 6)" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn btn-primary w-full" disabled={loading}>{loading ? '...' : 'Sign up'}</button>
      </form>
      <div className="text-sm mt-3">Have an account? <Link to="/login">Login</Link></div>
    </div>
  )
}
