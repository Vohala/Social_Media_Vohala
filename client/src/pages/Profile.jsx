import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import PostCard from '../components/PostCard.jsx'

export default function Profile() {
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [following, setFollowing] = useState(false)

  const load = async () => {
    try {
      const u = await api(`/api/users/${id}`)
      setUser(u)
      const ps = await api(`/api/posts/user/${id}`)
      setPosts(ps)
    } catch (e) { alert('Failed: ' + e.message) }
  }

  const toggleFollow = async () => {
    try {
      const res = await api(`/api/users/${id}/follow`, { method: 'POST' })
      setFollowing(res.following)
    } catch (e) { alert('Failed: ' + e.message) }
  }

  useEffect(() => { load() }, [id])

  if (!user) return <div className="mt-6">Loading...</div>

  return (
    <div className="mt-6">
      <div className="card mb-4 flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">{user.name}</div>
          <div className="text-sm text-neutral-500">{user.email}</div>
          <div className="text-sm mt-2">{user.bio || 'No bio yet.'}</div>
        </div>
        <button className="btn" onClick={toggleFollow}>{following ? 'Unfollow' : 'Follow'}</button>
      </div>
      {posts.map(p => <PostCard key={p._id} post={p} />)}
    </div>
  )
}
