import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Feed from './pages/Feed.jsx'
import Profile from './pages/Profile.jsx'
import Landing from './pages/Landing.jsx'
import Navbar from './components/Navbar.jsx'

export default function App() {
  const token = localStorage.getItem('token')
  return (
    <div className="container">
      <Navbar />
      <Routes>
        <Route path="/" element={token ? <Feed /> : <Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/u/:id" element={token ? <Profile /> : <Navigate to="/login" />} />
      </Routes>
    </div>
  )
}
