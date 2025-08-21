import { useState } from 'react'
import { api } from '../api'

export default function PostCard({ post }) {
  const [likes, setLikes] = useState(post.likes?.length || 0)
  const [liked, setLiked] = useState(false)
  const [comment, setComment] = useState('')
  const like = async () => {
    try {
      const res = await api(`/api/posts/${post._id}/like`, { method: 'POST' })
      setLiked(res.liked)
      setLikes(res.likesCount)
    } catch (e) { alert('Failed to like: ' + e.message) }
  }
  const addComment = async (e) => {
    e.preventDefault()
    if (!comment.trim()) return
    try {
      await api(`/api/posts/${post._id}/comment`, { method: 'POST', body: { text: comment } })
      setComment('')
    } catch (e) { alert('Failed: ' + e.message) }
  }
  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{post.user?.name}</div>
        <div className="text-xs text-neutral-500">{new Date(post.createdAt).toLocaleString()}</div>
      </div>
      <div className="mt-2 whitespace-pre-wrap">{post.text}</div>
      {post.imageUrl ? <img src={`http://localhost:5000${post.imageUrl}`} alt="" className="rounded-xl mt-3" /> : null}
      <div className="flex items-center gap-3 mt-3">
        <button className="btn" onClick={like}>{liked ? 'Unlike' : 'Like'} ({likes})</button>
      </div>
      <form className="mt-3 flex gap-2" onSubmit={addComment}>
        <input className="input" placeholder="Write a comment..." value={comment} onChange={e=>setComment(e.target.value)} />
        <button className="btn">Comment</button>
      </form>
    </div>
  )
}
