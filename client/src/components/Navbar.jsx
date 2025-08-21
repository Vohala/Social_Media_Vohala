import { Link, useNavigate } from 'react-router-dom'
import BrandLogo from './BrandLogo.jsx'

export default function Navbar() {
  const nav = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    nav('/');
  };
  return (
    <div className="py-5 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <BrandLogo size={28} />
      </Link>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <Link to={`/u/${user.id}`} className="btn">Profile</Link>
            <button className="btn btn-primary" onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn">Login</Link>
            <Link to="/register" className="btn btn-primary">Join Vohala</Link>
          </>
        )}
      </div>
    </div>
  )
}
