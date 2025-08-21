import { useEffect, useState } from 'react'
import { api } from '../api'
import PostComposer from '../components/PostComposer.jsx'
import PostCard from '../components/PostCard.jsx'

export default function Feed() {
  const [posts, setPosts] = useState([])
  const load = async () => {
    try {
      const data = await api('/api/posts/feed')
      setPosts(data)
    } catch (e) { alert('Failed to load feed: ' + e.message) }
  }
  useEffect(() => { load() }, [])
  return (
    <div className="mt-6">
      <PostComposer onCreated={(p)=>setPosts([p, ...posts])} />
      {posts.map(p => <PostCard key={p._id} post={p} />)}
    </div>
  )
}
