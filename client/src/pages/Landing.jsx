import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="mt-10">
      <div className="card p-0 overflow-hidden">
        <div className="gradient p-10 text-white">
          <div className="text-4xl font-extrabold">Vohala Social</div>
          <div className="mt-2 text-lg text-white/90">A clean, modern social network starter for your brand.</div>
          <div className="mt-6 flex gap-3">
            <Link to="/register" className="btn btn-primary">Create your account</Link>
            <Link to="/login" className="btn">Sign in</Link>
          </div>
        </div>
        <div className="p-6 grid md:grid-cols-3 gap-4">
          <Feature title="Create Posts" desc="Share text & images with your community." />
          <Feature title="Follow People" desc="Build your network and see their updates." />
          <Feature title="Engage" desc="Like & comment to keep conversations going." />
        </div>
      </div>
    </div>
  )
}

function Feature({ title, desc }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
      <div className="font-semibold">{title}</div>
      <div className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">{desc}</div>
    </div>
  )
}
